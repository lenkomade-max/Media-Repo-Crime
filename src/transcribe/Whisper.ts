import path from "path";
import { execa } from "execa";

/**
 * Запускает whisper CLI для распознавания аудио в .srt
 * Требует установленный whisper (`pip install -U openai-whisper`) и ffmpeg.
 * Возвращает путь к .srt
 */
export async function transcribeWithWhisper(audioPath: string, outDir: string, model = "base"): Promise<string> {
  // whisper сам создаст .srt в outDir с именем файла
  await execa("whisper", [audioPath, "--model", model, "--output_format", "srt", "--output_dir", outDir], {
    stdio: "pipe",
  });
  const base = path.basename(audioPath).replace(/\.[^.]+$/, "");
  return path.join(outDir, `${base}.srt`);
}
