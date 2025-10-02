import path from "path";
import { execa } from "execa";
import { log } from "../logger.js";

/**
 * Запускает whisper CLI для распознавания аудио в .srt
 * Требует установленный whisper (`pip install -U openai-whisper`) и ffmpeg.
 * Возвращает путь к .srt
 */
export async function transcribeWithWhisper(audioPath: string, outDir: string, model = "base"): Promise<string> {
  try {
    // whisper сам создаст .srt в outDir с именем файла
    const { stdout, stderr } = await execa("whisper", [audioPath, "--model", model, "--output_format", "srt", "--output_dir", outDir], {
      stdio: "pipe",
    });
    const base = path.basename(audioPath).replace(/\.[^.]+$/, "");
    return path.join(outDir, `${base}.srt`);
  } catch (error: any) {
    log.error(`Whisper Error: ${error.message}`);
    throw new Error(`Whisper transcription failed: ${error.message}`);
  }
}
