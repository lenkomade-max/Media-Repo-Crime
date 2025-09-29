import fs from "fs/promises";
import path from "path";
import { runFFmpeg } from "../utils/ffmpeg.js";
import { MediaFile } from "../types/plan.js";

export interface ResizeStrategy {
  /** Как масштабировать изображение */
  mode: "fit" | "fill" | "crop" | "stretch";
  /** Фоновый цвет для fill режима */
  backgroundColor?: string;
  /** Якорь для crop режима */
  cropAnchor?: "center" | "top" | "bottom" | "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Качество масштабирования */
  quality?: "fast" | "balanced" | "best";
}

export interface ProcessingOptions {
  targetWidth: number;
  targetHeight: number;
  fps: number;
  resize?: ResizeStrategy;
  /** Формат кодека для видео */
  codec?: "libx264" | "libx265" | "libvpx-vp9";
  /** Битрэйт для видео */
  bitrate?: string;
}

interface MediaFileInfo {
  width: number;
  height: number;
  duration: number;
  bitrate?: number;
}

/**
 * Расширенный медиа процессор для обработки фото и видео
 * С поддержкой различных стратегий resize, crop и оптимизации
 */
export class MediaProcessor {
  constructor(private options: ProcessingOptions) {}

  /**
   * Получает информацию о медиа файле
   */
  async getMediaInfo(filePath: string): Promise<MediaFileInfo> {
    const args = ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filePath];
    try {
      const result = await runFFmpeg(args, path.dirname(filePath));
      const info = JSON.parse(result.stdout);
      
      // Найдем основной видео поток
      const videoStream = info.streams.find((s: any) => s.codec_type === "video");
      const format = info.format;
      
      if (!videoStream) {
        throw new Error("No video stream found");
      }

      return {
        width: videoStream.width || videoStream.coded_width,
        height: videoStream.height || videoStream.coded_height,
        duration: parseFloat(format.duration || videoStream.duration || "0"),
        bitrate: parseInt(format.bit_rate || "0") || undefined
      };
    } catch (e: any) {
      throw new Error(`Failed to get media info: ${e.message}`);
    }
  }

  /**
   * Создает оптимизированную версию медиа файла
   */
  async optimizeMediaFile(
    inputPath: string,
    outputPath: string,
    workDir: string,
    mediaInfo: MediaFileInfo
  ): Promise<string> {
    const { targetWidth, targetHeight, resize = { mode: "fit", quality: "balanced" } } = this.options;

    let filterComplex = "";

    // Определяем strategy resize
    switch (resize.mode) {
      case "fit":
        // Вписывает изображение в рамки с сохранением пропорций + padding
        filterComplex = `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease`;
        if (resize.backgroundColor) {
          filterComplex += `,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:${resize.backgroundColor}`;
        } else {
          filterComplex += `,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black`;
        }
        break;

      case "fill":
        // Заполняет всю область, обрезая лишнее (smart crop)
        filterComplex = `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase`;
        filterComplex += `,crop=${targetWidth}:${targetHeight}`;
        break;

      case "crop":
        // Обрезает по якорю
        const offsetX = this.calculateCropOffset(mediaInfo, targetWidth, targetHeight, resize.cropAnchor || "center").x;
        const offsetY = this.calculateCropOffset(mediaInfo, targetWidth, targetHeight, resize.cropAnchor || "center").y;
        filterComplex = `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase`;
        filterComplex += `,crop=${targetWidth}:${targetHeight}:${offsetX}:${offsetY}`;
        break;

      case "stretch":
        // Растягивает без сохранения пропорций
        filterComplex = `scale=${targetWidth}:${targetHeight}`;
        break;
    }

    // Добавляем качественные настройки
    const qualityArgs = this.getQualityArgs(resize.quality || "balanced");

    const args = [
      "-y",
      "-i", path.resolve(inputPath),
      "-vf", filterComplex,
      ...qualityArgs,
      "-pix_fmt", "yuv420p",
      "-an", // Извлекаем только видео
      outputPath
    ];

    await runFFmpeg(args, workDir);
    return outputPath;
  }

  /**
   * Вычисляет смещение для crop операций
   */
  private calculateCropOffset(
    mediaInfo: MediaFileInfo,
    targetWidth: number,
    targetHeight: number,
    anchor: ResizeStrategy["cropAnchor"]
  ): { x: number; y: number } {
    const sourceAspect = mediaInfo.width / mediaInfo.height;
    const targetAspect = targetWidth / targetHeight;

    let offsetX = 0;
    let offsetY = 0;

    if (sourceAspect > targetAspect) {
      // Источник шире - обрезаем по бокам
      const scaledHeight = mediaInfo.height;
      const scaledWidth = scaledHeight * targetAspect;
      offsetX = (mediaInfo.width - scaledWidth) / 2;
      
      // Применяем якорь по X
      if (anchor && anchor.includes("left")) offsetX = 0;
      else if (anchor && anchor.includes("right")) offsetX = mediaInfo.width - scaledWidth;
    } else {
      // Источник выше - обрезаем сверху/снизу
      const scaledWidth = mediaInfo.width;
      const scaledHeight = scaledWidth / targetAspect;
      offsetY = (mediaInfo.height - scaledHeight) / 2;
      
      // Применяем якорь по Y
      if (anchor && anchor.includes("top")) offsetY = mediaInfo.height - scaledHeight;
      else if (anchor && anchor.includes("bottom")) offsetY = 0;
    }

    return { x: Math.round(offsetX), y: Math.round(offsetY) };
  }

  /**
   * Возвращает параметры качества для ffmpeg
   */
  private getQualityArgs(quality: ResizeStrategy["quality"]): string[] {
    switch (quality) {
      case "fast":
        return ["-preset", "ultrafast", "-crf", "28"];
      case "best":
        return ["-preset", "slow", "-crf", "18"];
      case "balanced":
      default:
        return ["-preset", "medium", "-crf", "23"];
    }
  }

  /**
   * Автоматически определяет оптимальные параметры для медиа файла
   */
  async getOptimalProcessingOptions(filePath: string): Promise<Partial<ProcessingOptions>> {
    const info = await this.getMediaInfo(filePath);
    const sourceAspect = info.width / info.height;
    const targetAspect = this.options.targetWidth / this.options.targetHeight;

    // Определяем стратегию автоматически
    let resizeStrategy: ResizeStrategy = { mode: "fit", quality: "balanced" };

    if (Math.abs(sourceAspect - targetAspect) < 0.1) {
      // Пропорции близки - можно использовать fill
      resizeStrategy.mode = "fill";
    } else if (info.duration > 0) {
      // Видео - используем crop для лучшего вида
      resizeStrategy.mode = "crop";
      resizeStrategy.cropAnchor = "center";
    }

    // Определяем качество на основе источника
    if (info.bitrate && info.bitrate > 5000000) {
      resizeStrategy.quality = "best";
    } else if (info.bitrate && info.bitrate < 1000000) {
      resizeStrategy.quality = "fast";
    }

    return {
      codec: this.options.codec || "libx264",
      bitrate: info.bitrate ? this.normalizeBitrate(info.bitrate).toString() : undefined,
      resize: resizeStrategy
    };
  }

  /**
   * Нормализует битрейт для выходного видео
   */
  private normalizeBitrate(sourceBitrate: number): number {
    const targetWidth = this.options.targetWidth;
    const targetHeight = this.options.targetHeight;
    const targetPixels = targetWidth * targetHeight;

    // Базовый битрейт для разных разрешений
    const baseRates: { [key: number]: number } = {
      1920 * 1080: 2500000,  // 1080p
      1280 * 720: 1500000,   // 720p
      854 * 480: 800000,     // 480p
    };

    // Ищем ближайшее базовое разрешение
    const baseRate = baseRates[targetPixels] || baseRates[1920 * 1080];
    
    // Ограничиваем исходный битрейт разумными пределами
    return Math.min(Math.max(sourceBitrate, baseRate * 0.5), baseRate * 2);
  }
}

/**
 * Утилиты для определения типа и содержимого медиа файлов
 */
export class MediaAnalyzer {
  /**
   * Определяет тип содержимого файла по анализу
   */
  async analyzeFileContent(filePath: string): Promise<{
    type: "photo" | "video";
    dominantColors?: string[];
    sceneComplexity?: "simple" | "medium" | "complex";
    textRegions?: { x: number; y: number; width: number; height: number }[];
  }> {
    try {
      // Используем ffprobe для анализа
      const result = await runFFmpeg(
        ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filePath],
        path.dirname(filePath)
      );

      const info = JSON.parse(result.stdout);
      const videoStream = info.streams.find((s: any) => s.codec_type === "video");

      if (!videoStream) {
        return { type: "photo" };
      }

      // Определяем сложность сцены по количеству цветов (упрощенно)
      const sceneComplexity = videoStream.width && videoStream.height
        ? videoStream.width * videoStream.height > 2073600 ? "complex" : "medium"
        : "simple";

      return {
        type: parseInt(videoStream.duration || "0") > 0.1 ? "video" : "photo",
        sceneComplexity,
        // TODO: Добавить анализ доминирующих цветов через ffmpeg filter
        // TODO: Добавить детекцию текстовых регионов
      };
    } catch (e) {
      // В случае ошибки считаем фото по умолчанию
      return { type: "photo", sceneComplexity: "simple" };
    }
  }
}
