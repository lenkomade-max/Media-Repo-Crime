import fs from "fs/promises";
import path from "path";
import { runFFmpeg } from "../utils/ffmpeg.js";
/**
 * Собирает смешанный таймлайн из фото и видео в единый клип slides.mp4
 * - Фото задаются через директивы duration
 * - Видео могут быть триммированы (trimStart/trimEnd)
 * Возвращает путь к временно собранному ролику.
 */
export async function buildSlidesVideo(input, workDir) {
    const listPath = path.join(workDir, "concat_list.txt");
    const lines = [];
    async function handleVideo(m) {
        const out = path.join(workDir, `${m.id}_clip.mp4`);
        const args = ["-y"];
        if (typeof m.trimStart === "number")
            args.push("-ss", String(m.trimStart));
        if (typeof m.trimEnd === "number")
            args.push("-to", String(m.trimEnd));
        args.push("-i", path.resolve(m.src), "-c", "copy", out);
        await runFFmpeg(args, workDir);
        return out;
    }
    const rendered = [];
    for (const m of input.files) {
        if (m.type === "video") {
            const clip = await handleVideo(m);
            rendered.push(clip);
            lines.push(`file '${clip.replace(/'/g, "'\\''")}'`);
        }
        else {
            const dur = typeof m.durationSec === "number" ? m.durationSec : input.durationPerPhoto;
            lines.push(`file '${path.resolve(m.src).replace(/'/g, "'\\''")}'`);
            lines.push(`duration ${dur.toFixed(3)}`);
        }
    }
    // для последней картинки concat демультиплексер требует повторить файл, чтобы duration применился
    const last = input.files[input.files.length - 1];
    if (last && last.type === "photo") {
        lines.push(`file '${path.resolve(last.src).replace(/'/g, "'\\''")}'`);
    }
    await fs.writeFile(listPath, lines.join("\n") + "\n", "utf8");
    const outVideo = path.join(workDir, "slides.mp4");
    await runFFmpeg([
        "-y",
        "-r", String(input.fps),
        "-f", "concat", "-safe", "0", "-i", listPath,
        "-vf", `scale=${input.width}:${input.height}:force_original_aspect_ratio=decrease,pad=${input.width}:${input.height}:(ow-iw)/2:(oh-ih)/2,setsar=1`,
        "-pix_fmt", "yuv420p",
        "-r", String(input.fps),
        outVideo,
    ], workDir);
    return outVideo;
}
