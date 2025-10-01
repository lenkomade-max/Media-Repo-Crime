import path from "path";
import { Storyboard, StoryboardSchema } from "../types/storyboard.js";
import { PlanInput } from "../types/plan.js";
import { loadDefaults } from "../config/Defaults.js";

export async function storyboardToPlan(sbRaw: any): Promise<PlanInput> {
  const defs = await loadDefaults();
  const sb: Storyboard = StoryboardSchema.parse(sbRaw);

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
  const nonEmptyFiles = files as [typeof files[0], ...typeof files];

  const plan: PlanInput = {
    files: nonEmptyFiles,
    music: sb.music,
    width,
    height,
    fps,
    durationPerPhoto: 2,
    outputFormat: "mp4",

    voiceFile: undefined,
    tts: sb.tts as any,
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

    overlays: sb.overlays as any,
    subtitleStyle: sb.subtitleStyle as any,
    groups: undefined,
    effects: sb.effects as any,
  };

  return plan;
}
