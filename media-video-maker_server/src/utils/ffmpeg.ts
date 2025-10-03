import { execa } from "execa";
import { log } from "../logger.js";

export async function runFFmpeg(args: string[], cwd?: string) {
  const cmd = ["-y", ...args];
  log.debug("ffmpeg", cmd.join(" "));
  try {
    const { stdout, stderr } = await execa("ffmpeg", cmd, { cwd });
    
    // Логируем stderr для диагностики
    if (stderr) {
      log.info(`FFmpeg stderr: ${stderr}`);
    }
    if (stdout) {
      log.info(`FFmpeg stdout: ${stdout}`);
    }
    
    return { stdout, stderr };
  } catch (error: any) {
    log.error("FFmpeg error:", {
      message: error.message,
      stderr: error.stderr,
      stdout: error.stdout,
      cmd: cmd.join(" ")
    });
    throw error;
  }
}

export async function runFFprobe(file: string) {
  const { stdout } = await execa("ffprobe", [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  return JSON.parse(stdout);
}

/** alias для совместимости с mcp.ts */
export async function ffprobeJson(file: string) {
  return runFFprobe(file);
}

/** Проверка наличия аудиопотока в видео для TTS валидации */
export async function checkVideoHasAudio(videoPath: string): Promise<{ hasAudio: boolean; audioStreams: number; details?: string }> {
  try {
    const info = await runFFprobe(videoPath);
    
    // Ищем аудиостримы
    const audioStreams = info.streams?.filter((stream: any) => stream.codec_type === 'audio') || [];
    const hasAudio = audioStreams.length > 0;
    
    let details = '';
    if (hasAudio) {
      details = audioStreams.map((stream: any) => 
        `codec=${stream.codec_name}, duration=${stream.duration}s, channels=${stream.channels}`
      ).join('; ');
    }
    
    log.info(`🔊 Audio check: ${videoPath} - hasAudio=${hasAudio}, streams=${audioStreams.length}${details ? `, details: ${details}` : ''}`);
    
    return {
      hasAudio,
      audioStreams: audioStreams.length,
      details: details || undefined
    };
  } catch (error: any) {
    log.error(`🔊 Audio check failed: ${videoPath} - ${error.message}`);
    return { hasAudio: false, audioStreams: 0, details: `Error: ${error.message}` };
  }
}
