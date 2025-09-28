import path from "path";
import { StoryboardSchema } from "../types/storyboard.js";
import { loadDefaults } from "../config/Defaults.js";
export async function storyboardToPlan(sbRaw) {
    const defs = await loadDefaults();
    const sb = StoryboardSchema.parse(sbRaw);
    const width = sb.canvas?.width ?? defs.canvas.width;
    const height = sb.canvas?.height ?? defs.canvas.height;
    const fps = sb.canvas?.fps ?? defs.canvas.fps;
    const files = (sb.timeline || []).map((t, i) => ({
        id: t.id || `it${i}`,
        src: path.resolve(t.src),
        type: t.type,
        durationSec: t.durationSec,
        trimStart: t.trimStart,
        trimEnd: t.trimEnd,
        group: t.group,
    }));
    if (files.length === 0) {
        throw new Error("Storyboard must contain at least one timeline item");
    }
    // TS-хак: гарантируем что массив непустой
    const nonEmptyFiles = files;
    const plan = {
        files: nonEmptyFiles,
        music: sb.music,
        width,
        height,
        fps,
        durationPerPhoto: 2,
        outputFormat: "mp4",
        voiceFile: undefined,
        tts: sb.tts,
        ttsText: sb.ttsText,
        transcribeAudio: false,
        burnSubtitles: false,
        musicVolumeDb: -6,
        ducking: {
            enabled: true,
            musicDuckDb: 8,
            threshold: 0.05,
            ratio: 8,
            attack: 5,
            release: 250,
        },
        overlays: sb.overlays,
        subtitleStyle: sb.subtitleStyle,
        groups: undefined,
        effects: sb.effects,
    };
    return plan;
}
