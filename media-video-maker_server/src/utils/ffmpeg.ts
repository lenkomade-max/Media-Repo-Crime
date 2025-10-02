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
