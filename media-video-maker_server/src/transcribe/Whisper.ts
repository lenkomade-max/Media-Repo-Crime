import fs from "fs/promises";
import path from "path";
import { execa } from "execa";
import { log } from "../logger.js";

/**
 * Проверка доступности Whisper CLI на сервере
 */
async function checkWhisperAvailability(): Promise<{ available: boolean; version?: string; error?: string }> {
  try {
    const { stdout } = await execa("whisper", ["--version"], { timeout: 5000 });
    return { available: true, version: stdout.trim() };
  } catch (error: any) {
    return { 
      available: false, 
      error: error.code === 'ENOENT' ? 'Whisper CLI not found' : error.message 
    };
  }
}

/**
 * Запускает whisper CLI для распознавания аудио в .srt
 * Требует установленный whisper (`pip install -U openai-whisper`) и ffmpeg.
 * Возвращает путь к .srt
 */
export async function transcribeWithWhisper(audioPath: string, outDir: string, model = "base"): Promise<string> {
  const startTime = Date.now();
  
  try {
    log.info(`🎤 Whisper Start: model=${model}, audio=${path.basename(audioPath)}`);
    
    // Проверка доступности Whisper
    const availability = await checkWhisperAvailability();
    if (!availability.available) {
      throw new Error(`Whisper CLI unavailable: ${availability.error}`);
    }
    
    log.info(`🎤 Whisper available: ${availability.version}`);
    
    // Проверка входного аудио файла
    const audioExists = await fs.access(audioPath).then(() => true).catch(() => false);
    if (!audioExists) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }
    
    const audioStats = await fs.stat(audioPath);
    log.info(`🎤 Audio file: ${audioPath} (${audioStats.size} bytes)`);
    
    // Валидация модели
    const validModels = ["tiny", "base", "small", "medium", "large", "large-v1", "large-v2", "large-v3"];
    if (!validModels.includes(model)) {
      log.warn(`🎤 Invalid model '${model}', using 'base' instead`);
      model = "base";
    }
    
    // Whisper команда с детальными логами
    const cmd = ["whisper", audioPath, "--model", model, "--output_format", "srt", "--output_dir", outDir];
    log.info(`🎤 Whisper command: ${cmd.join(" ")}`);
    
    const { stdout, stderr } = await execa("whisper", [audioPath, "--model", model, "--output_format", "srt", "--output_dir", outDir], {
      stdio: "pipe",
      timeout: 120000, // 2 минуты таймаут
    });
    
    if (stderr) {
      log.info(`🎤 Whisper stderr: ${stderr}`);
    }
    if (stdout) {
      log.info(`🎤 Whisper stdout: ${stdout}`);
    }
    
    // Поиск созданного SRT файла
    const base = path.basename(audioPath).replace(/\.[^.]+$/, "");
    const srtPath = path.join(outDir, `${base}.srt`);
    
    // Проверка создания SRT
    const srtExists = await fs.access(srtPath).then(() => true).catch(() => false);
    if (!srtExists) {
      throw new Error(`SRT file was not created: ${srtPath}`);
    }
    
    const srtStats = await fs.stat(srtPath);
    const srtContent = await fs.readFile(srtPath, "utf8");
    const subtitleCount = (srtContent.match(/^\d+$/gm) || []).length;
    
    log.info(`🎤 Whisper success: ${srtPath} (${srtStats.size} bytes, ${subtitleCount} subtitles, ${Date.now() - startTime}ms)`);
    
    return srtPath;
    
  } catch (error: any) {
    log.error(`🎤 Whisper Error (${Date.now() - startTime}ms): ${error.message}`);
    
    // Детальная диагностика ошибки
    if (error.code === 'ENOENT') {
      log.error(`🎤 Whisper CLI not found. Install: pip3 install openai-whisper`);
    } else if (error.timedOut) {
      log.error(`🎤 Whisper timeout after ${error.timeout}ms`);
    } else if (error.stderr) {
      log.error(`🎤 Whisper stderr: ${error.stderr}`);
    }
    
    throw new Error(`Whisper transcription failed: ${error.message}`);
  }
}
