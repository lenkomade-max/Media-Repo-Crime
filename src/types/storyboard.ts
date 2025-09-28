import { z } from "zod";

/** Канва сториборда (может переопределить дефолты) */
export const CanvasSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
  fps: z.number().optional(),
});

/** Блок таймлайна (фото/видео) */
export const TimelineItemSchema = z.object({
  id: z.string().optional(),
  src: z.string(),
  type: z.enum(["photo", "video"]).default("photo"),
  durationSec: z.number().optional(), // для фото
  trimStart: z.number().optional(),   // для видео
  trimEnd: z.number().optional(),
  group: z.string().optional(),
});

/** Верхнего уровня Storyboard */
export const StoryboardSchema = z.object({
  canvas: CanvasSchema.optional(),
  timeline: z.array(TimelineItemSchema).nonempty(),
  music: z.string().optional(),
  tts: z
    .object({
      provider: z.enum(["kokoro", "openai", "none"]).default("none"),
      endpoint: z.string().optional(),
      voice: z.string().optional(),
      model: z.string().optional(),
      format: z.enum(["mp3", "wav"]).optional(),
      speed: z.number().optional(),
    })
    .optional(),
  ttsText: z.string().optional(),
  overlays: z.array(z.any()).optional(),
  subtitleStyle: z.any().optional(),
  effects: z.array(z.any()).optional(),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;
