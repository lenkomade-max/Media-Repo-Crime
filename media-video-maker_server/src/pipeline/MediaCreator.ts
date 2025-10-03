import fs from "fs/promises";
import path from "path";
import fse from "fs-extra";
import * as uuid from "uuid";
import { runFFmpeg, checkVideoHasAudio } from "../utils/ffmpeg.js";
import { PlanInput, PlanInputSchema, JobStatus } from "../types/plan.js";
import { buildSlidesVideo } from "./ConcatPlanBuilder.js";
import { resolveVoiceTrack } from "../audio/TTSService.js";
import { transcribeWithWhisper } from "../transcribe/Whisper.js";
import { validateFileExists } from "../utils/fs.js";
import { buildAudioFilter } from "../audio/AudioMixer.js";
import { buildVideoOverlayFilter } from "./OverlayRenderer.js";
import { log } from "../logger.js";
import { FileDownloader } from "../utils/FileDownloader.js";

const uuidv4 = uuid.v4;

type QueueItem = { id: string; input: PlanInput };

export default class MediaCreator {
  private queue: QueueItem[] = [];
  private running = 0; // Количество одновременно выполняющихся задач
  private maxConcurrent = 3; // Максимум 3 задачи одновременно
  private statuses = new Map<string, JobStatus>();
  private completed = new Map<string, JobStatus>();
  private cancelled = new Set<string>();
  private fileDownloader = new FileDownloader();
  private downloadedFiles = new Map<string, string[]>();

  /** колбэк для SSE */
  public onStatus?: (status: JobStatus) => void;

  enqueueJob(input: PlanInput) { return this.enqueue(input); }
  getStatus(id: string) { return this.statuses.get(id) || this.completed.get(id); }
  
  /**
   * Создает идеальное криминальное видео по умолчанию
   * @param script - текст сценария для озвучки
   * @param hookText - текст верхнего оверлея (hook)
   * @param baitText - текст нижнего оверлея (bait)
   * @param images - количество изображений (по умолчанию 30)
   * @param duration - общая длительность в секундах
   */
  
  // Новые методы для API
  getAllJobs(limit = 20, offset = 0) {
    const all = Array.from(this.statuses.values()).concat(Array.from(this.completed.values()));
    const sorted = all.sort((a, b) => (b as any).createdAt || 0 - (a as any).createdAt || 0);
    const total = sorted.length;
    return {
      jobs: sorted.slice(offset, offset + limit),
      pagination: { limit, offset, total, hasMore: offset + limit < total }
    };
  }

  cancelJob(id: string) {
    if (!this.statuses.has(id)) {
      return false;
    }
    this.cancelled.add(id);
    return true;
  }

  enqueue(input: PlanInput) {
    const parsed = PlanInputSchema.parse(input);
    const id = uuidv4();
    const status: JobStatus & { createdAt: number } = { 
      id, 
      state: "queued", 
      progress: 0,
      createdAt: Date.now()
    };
    this.statuses.set(id, status);
    this.onStatus?.(status);
    this.queue.push({ id, input: parsed });
    this.pump();
    return id;
  }

  private async pump() {
    if (this.running >= this.maxConcurrent) return;
    const item = this.queue.shift();
    if (!item) return;
    
    // Проверяем отмену перед началом обработки
    if (this.cancelled.has(item.id)) {
      this.cancelled.delete(item.id);
      this.statuses.delete(item.id);
      this.pump();
      return;
    }
    
    this.running++;
    try {
      let status: JobStatus & { createdAt: number } = { 
        id: item.id, 
        state: "running", 
        progress: 0, 
        message: "init",
        createdAt: Date.now()
      };
      this.statuses.set(item.id, status);
      this.onStatus?.(status);

      // Проверяем отмену во время обработки
      if (this.cancelled.has(item.id)) {
        this.cancelled.delete(item.id);
        status = { id: item.id, state: "error", error: "Job cancelled by user", createdAt: Date.now() };
        this.statuses.set(item.id, status);
        this.onStatus?.(status);
        return;
      }

      const out = await this.process(item.id, item.input);

      // Финальная проверка отмены
      if (this.cancelled.has(item.id)) {
        this.cancelled.delete(item.id);
        status = { id: item.id, state: "error", error: "Job cancelled during finalization", createdAt: Date.now() };
      } else {
        status = { id: item.id, state: "done", output: out.output, srt: out.srt, vtt: out.vtt, createdAt: Date.now() };
        // Перемещаем в архив выполненных
        this.completed.set(item.id, status);
      }
      
      this.statuses.set(item.id, status);
      this.onStatus?.(status);
      this.statuses.delete(item.id); // Удаляем из активных после завершения
    } catch (e: any) {
      const status: JobStatus & { createdAt: number } = { 
        id: item.id, 
        state: "error", 
        error: e?.message || String(e),
        createdAt: Date.now()
      };
      this.statuses.set(item.id, status);
      // Сохраняем ошибочную задачу в архив, чтобы /api/status не отдавал NOT_FOUND
      this.completed.set(item.id, status);
      this.onStatus?.(status);
      this.statuses.delete(item.id);
    } finally {
      this.running--;
      this.pump(); // Обрабатываем следующую задачу
    }
  }

  private async process(id: string, input: PlanInput): Promise<{ output: string; srt?: string; vtt?: string }> {
    const workRoot = process.env.OUTPUT_DIR || "/app/output";
    const workDir = path.join(workRoot, `job_${id}`);
    await fse.ensureDir(workDir);

    // 0) Скачивание файлов по URL
    const processedInput = await this.downloadFiles(id, input);

    // 1) Сборка слайдов
    const slidesPath = await buildSlidesVideo(processedInput, workDir);

    // 2) Озвучка
    let voicePath: string | null = null;
    try {
      voicePath = await resolveVoiceTrack(processedInput, workDir);
      if (voicePath) {
        log.info(`✅ MediaCreator: TTS successful, audio file: ${voicePath}`);
      }
    } catch (error: any) {
      log.error(`❌ MediaCreator: TTS failed: ${error.message}`);
      // Важно: не игнорируем TTS ошибки, если TTS требуется
      if (processedInput.tts && processedInput.tts.provider !== "none" && processedInput.ttsText) {
        throw new Error(`TTS is required but failed: ${error.message}`);
      }
      voicePath = null;
    }

    // 3) Субтитры через Whisper (совместимая версия)
    let srtPath: string | undefined;
    if (processedInput.transcribeAudio && voicePath) {
      try {
        srtPath = await transcribeWithWhisper(voicePath, workDir, "base");
        console.log(`🎤 Whisper: создан ${srtPath}`);
      } catch (e: any) {
        console.error("Ошибка Whisper:", e.message);
        throw new Error(`Whisper failed: ${e?.message || e}`);
      }
    }

    // 4) Сборка финального ролика
    const outPath = path.join(workRoot, `video_${id}.${processedInput.outputFormat}`);
    const args: string[] = ["-y", "-i", slidesPath];

    const hasMusic = !!processedInput.music;
    const hasVoice = !!voicePath;
    if (hasMusic) {
      const musicPath = path.resolve(processedInput.music!);
      if (!await validateFileExists(musicPath)) {
        throw new Error(`Music file not found: ${processedInput.music}`);
      }
      args.push("-i", musicPath);
    }
    if (hasVoice) args.push("-i", voicePath!);

    // Строим видео фильтры (эффекты, оверлеи, субтитры)
    const { filter: videoFilter, finalLabel: videoFinalLabel, extraInputs } = await buildVideoOverlayFilter(
      processedInput,
      workDir,
      "[0:v]",
      srtPath,
      "ForceStyle=FontSize=32,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,MarginV=300,Bold=1",
      hasMusic ? 1 : 0
    );

    // Добавляем дополнительные входы для оверлеев
    for (const extraInput of extraInputs) {
      const absInput = path.isAbsolute(extraInput)
        ? extraInput
        : path.resolve("/root/media-video-maker_project", extraInput);
      args.push("-i", absInput);
    }

    // Строим аудио фильтры
    const musicIndex = hasMusic ? 1 : -1;
    const voiceIndex = hasVoice ? (hasMusic ? 2 : 1) : -1;
    
    const { chain: audioChain, finalLabel: audioFinalLabel } = buildAudioFilter({
      hasMusic,
      hasVoice,
      musicVolumeDb: processedInput.musicVolumeDb ?? -6,
      ducking: processedInput.ducking,
      musicInLabel: hasMusic ? `[${musicIndex}:a]` : "",
      voiceInLabel: hasVoice ? `[${voiceIndex}:a]` : "",
    });
    log.info(`Audio debug: audioChain="${audioChain}", audioFinalLabel="${audioFinalLabel}"`);

    // Объединяем видео и аудио фильтры
    const allFilters = [];
    if (videoFilter) allFilters.push(videoFilter);
    if (audioChain) allFilters.push(audioChain);
    
    if (allFilters.length > 0) {
      args.push("-filter_complex", allFilters.join(";"));
    }

    // Маппинг видео
    if (videoFinalLabel) {
      args.push("-map", videoFinalLabel);
    } else {
      args.push("-map", "0:v:0");
    }

    // Маппинг аудио
    log.info(`Audio mapping: hasMusic=${hasMusic}, hasVoice=${hasVoice}, audioFinalLabel="${audioFinalLabel}"`);
    if (audioFinalLabel) {
      // Для прямого маппинга без фильтров (например [1:a])
      args.push("-map", audioFinalLabel);
      args.push("-c:a", "aac", "-b:a", "192k");
    } else if (hasMusic) {
      args.push("-map", `${musicIndex}:a:0`, "-c:a", "aac", "-b:a", "192k");
    }

    // Оптимизированное кодирование: быстрый пресет для низких разрешений
    const isLowRes = ((processedInput.width ?? 0) <= 854) || ((processedInput.height ?? 0) <= 854);
    args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(processedInput.fps));
    args.push("-preset", isLowRes ? "ultrafast" : "veryfast");
    args.push("-crf", isLowRes ? "28" : "26");
    
    args.push(outPath);

    await runFFmpeg(args, workDir);

    // Проверка наличия аудиопотока в выходном видео (задача #5 из плана)
    const audioCheck = await checkVideoHasAudio(outPath);
    
    // Если TTS генерировался, но аудио отсутствует — логируем и генерируем автоповтор
    if (voicePath && !audioCheck.hasAudio) {
      log.error(`❌ MediaCreator: TTS was generated but output video has no audio stream!`);
      log.error(`📝 Request dump for retry: ${JSON.stringify({ 
        id, 
        tts: processedInput.tts, 
        ttsText: processedInput.ttsText,
        voiceFile: voicePath,
        hasMusic,
        hasVoice 
      }, null, 2)}`);
      
      // Пока логируем ошибку, в будущем можно добавить автоповтор
      throw new Error(`Video generated without audio despite TTS success. Check FFmpeg audio mapping.`);
    } else if (audioCheck.hasAudio && voicePath) {
      log.info(`✅ MediaCreator: Audio validation passed - ${audioCheck.audioStreams} stream(s): ${audioCheck.details}`);
    }

    // Очистка скачанных файлов после успешного создания видео
    await this.cleanupDownloadedFiles(id);

    return { output: outPath, srt: srtPath };
  }

  private async downloadFiles(jobId: string, input: PlanInput): Promise<PlanInput> {
    log.info(`📥 Начинаем скачивание файлов для job ${jobId}`);
    
    const processedInput = { ...input };
    const downloadedFiles: string[] = [];
    
    try {
      // Скачивание файлов из массива files
      for (const file of processedInput.files) {
        if (file.download && await this.fileDownloader.isUrl(file.src)) {
          log.info(`📥 Скачивание файла: ${file.src}`);
          
          const result = await this.fileDownloader.ensureFileExists(file.src);
          file.src = result;
          downloadedFiles.push(result);
          
          log.info(`✅ Файл скачан: ${result}`);
        }
      }
      
      // Скачивание музыки
      if (processedInput.music && processedInput.musicDownload && await this.fileDownloader.isUrl(processedInput.music)) {
        log.info(`📥 Скачивание музыки: ${processedInput.music}`);
        
        const result = await this.fileDownloader.ensureFileExists(processedInput.music);
        processedInput.music = result;
        downloadedFiles.push(result);
        
        log.info(`✅ Музыка скачана: ${result}`);
      }
      
      // Скачивание TTS файла
      if (processedInput.voiceFile && await this.fileDownloader.isUrl(processedInput.voiceFile)) {
        log.info(`📥 Скачивание TTS файла: ${processedInput.voiceFile}`);
        
        const result = await this.fileDownloader.ensureFileExists(processedInput.voiceFile);
        processedInput.voiceFile = result;
        downloadedFiles.push(result);
        
        log.info(`✅ TTS файл скачан: ${result}`);
      }
      
      // Сохраняем список скачанных файлов для последующей очистки
      this.downloadedFiles.set(jobId, downloadedFiles);
      
      log.info(`✅ Скачивание завершено. Файлов: ${downloadedFiles.length}`);
      return processedInput;
      
    } catch (error: any) {
      log.error(`❌ Ошибка скачивания файлов: ${error.message}`);
      
      // Очищаем скачанные файлы при ошибке
      await this.cleanupDownloadedFiles(jobId);
      throw error;
    }
  }
  
  private async cleanupDownloadedFiles(jobId: string): Promise<void> {
    const files = this.downloadedFiles.get(jobId);
    if (!files) return;
    
    try {
      log.info(`🧹 Очистка скачанных файлов для job ${jobId}`);
      
      for (const file of files) {
        try {
          await fse.remove(file);
          log.info(`🗑️ Удален файл: ${file}`);
        } catch (error) {
          log.warn(`⚠️ Не удалось удалить файл ${file}: ${error}`);
        }
      }
      
      this.downloadedFiles.delete(jobId);
      log.info(`✅ Очистка завершена`);
      
    } catch (error: any) {
      log.error(`❌ Ошибка очистки: ${error.message}`);
    }
  }
}
