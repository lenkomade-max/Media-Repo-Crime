import { z } from 'zod';

/**
 * Схема для файлов медиа (фото/видео)
 * Расширена поддержкой URL через флаг download
 */
export const MediaFileSchema = z.object({
  id: z.string(),
  src: z.string(), // Может быть путь или URL
  type: z.enum(["photo", "video"]).default("photo"),
  download: z.boolean().optional(), // Флаг для скачивания
  duration: z.number().optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  aspectRatio: z.string().optional(),
  effects: z.array(z.any()).optional(),
  overlays: z.array(z.any()).optional(),
  subtitle: z.string().optional()
});

/**
 * Схема для опций Text-to-Speech
 * Расширена поддержкой URL через флаг download
 */
export const TTSOptionsSchema = z.object({
  provider: z.enum(["kokoro", "openai", "none"]).default("none"),
  endpoint: z.string().optional(),
  voice: z.string().default("alloy"),
  model: z.string().default("gpt-4o-mini-tts"),
  format: z.enum(["mp3", "wav"]).default("mp3"),
  speed: z.number().default(1.0),
  download: z.boolean().optional(), // Для внешних TTS файлов
});

/**
 * Схема для ввода плана создания видео
 * Расширена поддержкой URL для музыки
 */
export const PlanInputSchema = z.object({
  files: z.array(MediaFileSchema).nonempty(),
  output: z.string(),
  duration: z.number().optional(),
  resolution: z.string().optional().default("1080x1920"),
  fps: z.number().optional().default(30),
  music: z.string().optional(), // Может быть URL
  musicDownload: z.boolean().optional(), // Флаг для скачивания музыки
  voiceFile: z.string().optional(),
  tts: TTSOptionsSchema.optional(),
  subtitles: z.boolean().optional().default(false),
  effects: z.array(z.any()).optional(),
  overlays: z.array(z.any()).optional(),
  transitions: z.array(z.any()).optional(),
  webhook: z.string().optional() // URL для отправки уведомления о готовности
});

/**
 * Схема для результата обработки плана
 */
export const PlanResultSchema = z.object({
  jobId: z.string(),
  status: z.enum(["completed", "failed", "processing"]),
  videoUrl: z.string().optional(),
  downloadUrl: z.string().optional(),
  cleanupCompleted: z.boolean().optional(),
  timestamp: z.string(),
  error: z.string().optional()
});

export type MediaFile = z.infer<typeof MediaFileSchema>;
export type TTSOptions = z.infer<typeof TTSOptionsSchema>;
export type PlanInput = z.infer<typeof PlanInputSchema>;
export type PlanResult = z.infer<typeof PlanResultSchema>;
