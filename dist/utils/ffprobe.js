import { execa } from "execa";
/** Возвращает json c форматами/стримами ffprobe */
export async function ffprobeJson(filePath) {
    const { stdout } = await execa("ffprobe", [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        filePath,
    ]);
    try {
        return JSON.parse(stdout);
    }
    catch {
        return { raw: stdout };
    }
}
