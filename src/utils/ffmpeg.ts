import { execa } from "execa";
import { log } from "../logger.js";

export async function runFFmpeg(args: string[], cwd?: string) {
  log.debug("ffmpeg", args.join(" "));
  const p = execa("ffmpeg", ["-y", ...args], { cwd });
  await p;
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
