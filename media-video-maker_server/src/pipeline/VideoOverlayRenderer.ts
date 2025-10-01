import fs from "fs/promises";
import path from "path";
import type { VideoOverlay, PlanInput } from "../types/plan.js";
import { log } from "../logger.js";

/**
 * VideoOverlayRenderer - обработка видео оверлеев с blend modes
 * Поддерживает наложение видео файлов поверх основного видео с различными режимами смешивания
 */
export class VideoOverlayRenderer {
  /**
   * Строит FFmpeg filter для video overlays
   * @param input - конфигурация плана
   * @param baseVideoLabel - метка основного видео (например "[0:v]")
   * @param workDir - рабочая директория
   * @returns объект с filter, finalLabel и extraInputs
   */
  static async buildVideoOverlayFilter(
    input: PlanInput,
    baseVideoLabel: string = "[0:v]",
    workDir: string,
    musicInputs: number = 0
  ): Promise<{ filter: string; finalLabel: string; extraInputs: string[] }> {
    const videoOverlays = input.videoOverlays || [];
    const timeline = input.timeline;
    
    // Если есть timeline структура, используем overlays оттуда
    const overlaysToProcess = timeline?.overlays || videoOverlays;
    
    if (!overlaysToProcess || overlaysToProcess.length === 0) {
      return {
        filter: "",
        finalLabel: baseVideoLabel,
        extraInputs: []
      };
    }

    const chains: string[] = [];
    const extraInputs: string[] = [];
    let current = baseVideoLabel;
    let step = 0;

    log.info(`Processing ${overlaysToProcess.length} video overlays`);

    // Сортируем оверлеи по времени начала для корректного наложения
    const sortedOverlays = [...overlaysToProcess].sort((a, b) => a.start - b.start);

    for (const overlay of sortedOverlays) {
      await this.validateOverlayFile(overlay.file);
      
      step++;
      const overlayInputIndex = extraInputs.length;
      
      // Добавляем overlay файл БЕЗ trim - контролируем через enable в фильтре
      // Используем абсолютный путь для корректной работы FFmpeg (относительно корня проекта)
      const absolutePath = path.isAbsolute(overlay.file) 
        ? overlay.file 
        : path.resolve('/root/media-video-maker_project', overlay.file);
      extraInputs.push(absolutePath);
      
      const out = `[voverlay_${step}]`;
      const overlayFilter = this.buildSingleOverlayFilter(
        overlay,
        current,
        `[${overlayInputIndex + 1 + musicInputs}:v]`, // +1 потому что [0] - это основное видео, +musicInputs для аудио
        out
      );
      
      chains.push(overlayFilter);
      current = out;
      
      log.info(`Added video overlay: ${path.basename(overlay.file)} with ${overlay.blendMode} blend mode`);
    }

    const finalFilter = chains.length > 0 ? chains.join(";") : "";
    
    return {
      filter: finalFilter,
      finalLabel: current,
      extraInputs
    };
  }

  /**
   * Строит filter для одного video overlay
   */
  private static buildSingleOverlayFilter(
    overlay: VideoOverlay,
    baseLabel: string,
    overlayLabel: string,
    outputLabel: string
  ): string {
    const { blendMode, start, end, opacity, scale, position } = overlay;
    
    // Позиция overlay (0,0 = полный экран)
    const x = position?.x || 0;
    const y = position?.y || 0;
    
    // Временные ограничения
    const timeCondition = `between(t,${start},${end})`;
    
    // Blend mode mapping для FFmpeg
    const blendModeMap: Record<string, string> = {
      "overlay": "overlay",
      "screen": "screen",
      "multiply": "multiply", 
      "softlight": "softlight",
      "hardlight": "hardlight",
      "lighten": "lighten",
      "darken": "darken",
      "difference": "difference",
      "exclusion": "exclusion",
      "color-dodge": "colordodge",
      "color-burn": "colorburn"
    };
    
    const ffmpegBlendMode = blendModeMap[blendMode] || "overlay";
    
    // Создаем уникальную метку для масштабированного overlay
      let step = 0;
      const scaledLabel = `[scaled_${++step}]`;
    
    // Масштабируем overlay к размеру base видео (640x360)
    const scaleFilter = `${overlayLabel}scale=640:360${scaledLabel}`;
    
    // Дополнительное масштабирование если нужно
    let finalOverlayLabel = scaledLabel;
    if (scale && scale !== 1.0) {
      const scaled2Label = `[scaled2_${Math.random().toString(36).substr(2, 9)}]`;
      const scale2Filter = `${scaledLabel}scale=iw*${scale}:ih*${scale}${scaled2Label}`;
      finalOverlayLabel = scaled2Label;
    }
    
    // Детекция VHS-оверлеев по имени файла, чтобы смягчить цвет и интенсивность
    const fileLower = (overlay as any).file?.toLowerCase?.() || "";
    const isVhsOverlay = fileLower.includes("vhs ") || fileLower.includes("vhs") || fileLower.includes("overlay_arrow_fake_never_matches");

    // Уменьшаем насыщенность (убираем зеленый оттенок) для VHS: hue=s=0
    if (isVhsOverlay) {
      const desatLabel = `[desat_${Math.random().toString(36).substr(2, 9)}]`;
      const desatFilter = `${finalOverlayLabel}hue=s=0${desatLabel}`;
      finalOverlayLabel = desatLabel;
    }

    // Прозрачность (для VHS ограничим максимум до 0.35 по умолчанию)
    const targetOpacity = isVhsOverlay ? Math.min(opacity ?? 1, 0.35) : (opacity ?? 1);
    if (targetOpacity < 1.0) {
      const prepLabel = `[prep_${Math.random().toString(36).substr(2, 9)}]`;
      const opacityFilter = `${finalOverlayLabel}format=yuva420p,colorchannelmixer=aa=${targetOpacity}${prepLabel}`;
      finalOverlayLabel = prepLabel;
    }
    
    // Применяем blend mode с временным контролем через enable
    if (ffmpegBlendMode !== "overlay") {
      return `${scaleFilter};${baseLabel}${finalOverlayLabel}blend=all_mode='${ffmpegBlendMode}':enable='${timeCondition}'${outputLabel}`;
    } else {
      return `${scaleFilter};${baseLabel}${finalOverlayLabel}overlay=${x}:${y}:enable='${timeCondition}'${outputLabel}`;
    }
  }

  /**
   * Валидация файла overlay
   */
  private static async validateOverlayFile(filePath: string): Promise<void> {
    try {
      await fs.access(filePath);
      const stats = await fs.stat(filePath);
      
      if (!stats.isFile()) {
        throw new Error(`Video overlay path is not a file: ${filePath}`);
      }
      
      // Проверяем расширение файла
      const ext = path.extname(filePath).toLowerCase();
      const supportedFormats = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
      
      if (!supportedFormats.includes(ext)) {
        log.warn(`Video overlay has unsupported format: ${ext}. Supported: ${supportedFormats.join(', ')}`);
      }
      
    } catch (error) {
      throw new Error(`Video overlay file not accessible: ${filePath} - ${error}`);
    }
  }

  /**
   * Получает информацию о видео overlay для логирования
   */
  static async getOverlayInfo(overlays: VideoOverlay[]): Promise<string> {
    const info = overlays.map((overlay, index) => {
      const fileName = path.basename(overlay.file);
      const duration = overlay.end - overlay.start;
      return `${index + 1}. ${fileName} (${overlay.blendMode}, ${duration}s, ${overlay.start}s-${overlay.end}s)`;
    });
    
    return `Video Overlays (${overlays.length}):\n${info.join('\n')}`;
  }
}
