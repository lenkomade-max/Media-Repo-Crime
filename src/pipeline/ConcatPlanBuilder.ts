import fs from "fs/promises";
import path from "path";
import { PlanInput, MediaFile } from "../types/plan.js";
import { runFFmpeg } from "../utils/ffmpeg.js";
import { MediaProcessor, MediaAnalyzer } from "./MediaProcessor.js";

/**
 * Собирает смешанный таймлайн из фото и видео в единый клип slides.mp4 (ЭТАП 3)
 * - Поддержка улучшенного resize/crop (smart crop, качество масштабирования)
 * - Фото задаются через директивы duration
 * - Видео могут быть триммированы (trimStart/trimEnd)
 * - Автоматическое определение оптимальных параметров обработки
 * Возвращает путь к временно собранному ролику.
 */
export async function buildSlidesVideo(input: PlanInput, workDir: string): Promise<string> {
  const listPath = path.join(workDir, "concat_list.txt");
  const lines: string[] = [];

  // Создаем медиа процессор с целевыми параметрами
  const processor = new MediaProcessor({
    targetWidth: input.width,
    targetHeight: input.height,
    fps: input.fps
  });

  const analyzer = new MediaAnalyzer();

  /**
   * Обработка видео файла с улучшенной логикой
   */
  async function handleVideo(m: MediaFile): Promise<string> {
    const out = path.join(workDir, `${m.id}_clip.mp4`);
    
    // Анализируем содержимое файла для оптимизации
    const analysis = await analyzer.analyzeFileContent(path.resolve(m.src));
    
    // Получаем оптимальные параметры обработки
    const optimalOptions = await processor.getOptimalProcessingOptions(path.resolve(m.src));
    
    // Базовые аргументы для обрезки
    const args: string[] = ["-y"];
    if (typeof m.trimStart === "number") args.push("-ss", String(m.trimStart));
    if (typeof m.trimEnd === "number") args.push("-to", String(m.trimEnd));
    args.push("-i", path.resolve(m.src));

    // Добавляем улучшенную обработку видео
    if (analysis.sceneComplexity === "complex") {
      // Сложная сцена - используем лучшие настройки
      args.push("-preset", "slow", "-crf", "20");
    } else if (analysis.sceneComplexity === "simple") {
      // Простая сцена - можем ускорить обработку
      args.push("-preset", "fast", "-crf", "26");
    } else {
      // Средняя сложность - сбалансированные настройки
      args.push("-preset", "medium", "-crf", "23");
    }

    // Применяем оптимальные параметры
    if (optimalOptions.bitrate) {
      args.push("-b:v", optimalOptions.bitrate);
    }

    args.push("-c:v", optimalOptions.codec || "libx264");
    args.push("-pix_fmt", "yuv420p");
    args.push(out);

    await runFFmpeg(args, workDir);
    return out;
  }

  /**
   * Обработка фото файла с улучшенным resize/crop
   */
  async function handlePhoto(m: MediaFile): Promise<string> {
    const sourcePath = path.resolve(m.src);
    const mediaInfo = await processor.getMediaInfo(sourcePath);
    
    // Автоматически выбираем стратегию resize
    const sourceAspect = mediaInfo.width / mediaInfo.height;
    const targetAspect = input.width / input.height;
    
    const out = path.join(workDir, `${m.id}_optimized.${m.src.split('.').pop()}`);
    
    try {
      // Оптимизируем изображение с умной стратегией
      await processor.optimizeMediaFile(sourcePath, out, workDir, mediaInfo);
      return out;
    } catch (e: any) {
      console.warn(`Ошибка оптимизации фото ${m.id}: ${e.message}. Используем оригинал.`);
      return sourcePath;
    }
  }

  // Обрабатываем все файлы с улучшенной логикой
  const rendered: string[] = [];
  for (const m of input.files) {
    try {
      let processedFile: string;
      
      if (m.type === "video") {
        processedFile = await handleVideo(m);
        lines.push(`file '${processedFile.replace(/'/g, "'\\''")}'`);
      } else {
        processedFile = await handlePhoto(m);
        const dur = typeof m.durationSec === "number" ? m.durationSec : input.durationPerPhoto;
        lines.push(`file '${processedFile.replace(/'/g, "\'\\\'\'")}'`);
        lines.push(`duration ${dur.toFixed(3)}`);
      }
      
      rendered.push(processedFile);
    } catch (e: any) {
      console.error(`Ошибка обработки файла ${m.id} (${m.src}): ${e.message}`);
      // Fallback к оригинальному файлу
      const fallbackFile = path.resolve(m.src);
      rendered.push(fallbackFile);
      if (m.type === "video") {
        lines.push(`file '${fallbackFile.replace(/'/g, "'\\''")}'`);
      } else {
        const dur = typeof m.durationSec === "number" ? m.durationSec : input.durationPerPhoto;
        lines.push(`file '${fallbackFile.replace(/'/g, "'\\''")}'`);
        lines.push(`duration ${dur.toFixed(3)}`);
      }
    }
  }

  // для последней картинки concat демультиплексер требует повторить файл, чтобы duration применился
  const last = input.files[input.files.length - 1];
  if (last && last.type === "photo") {
    lines.push(`file '${rendered[rendered.length - 1].replace(/'/g, "\'\\\'\'")}'`);
  }

  await fs.writeFile(listPath, lines.join("\n") + "\n", "utf8");

  // Финальная сборка с улучшенным pipeline  
  const outVideo = path.join(workDir, "slides.mp4");
  
  // Определяем стратегию финального масштабирования
  const finalResizeMode = input.files.some(f => f.type === "video") ? "smart_crop" : "fit_with_padding";
  
  let finalFilter = "";
  if (finalResizeMode === "smart_crop") {
    // Для смешанного контента используем smart crop
    finalFilter = `scale=${input.width}:${input.height}:force_original_aspect_ratio=increase,crop=${input.width}:${input.height}`;
  } else {
    // Для фото - вписываем с padding
    finalFilter = `scale=${input.width}:${input.height}:force_original_aspect_ratio=decrease,pad=${input.width}:${input.height}:(ow-iw)/2:(oh-ih)/2:black`;
  }

  await runFFmpeg(
    [
      "-y",
      "-r", String(input.fps),
      "-f", "concat", "-safe", "0", "-i", listPath,
      "-vf", `${finalFilter},setsar=1`,
      "-pix_fmt", "yuv420p",
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "23",
      "-r", String(input.fps),
      outVideo,
    ],
    workDir
  );

  return outVideo;
}