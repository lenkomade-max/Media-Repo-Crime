import fs from "fs/promises";
import path from "path";
import { PlanInput, TTSOptions } from "../types/plan.js";
import { log } from "../logger.js";

/**
 * Возвращает путь к аудио озвучки:
 * - если задан voiceFile — используем его
 * - если есть tts+ttsText — генерируем через Kokoro или OpenAI
 * - иначе возвращает null
 */
export async function resolveVoiceTrack(input: PlanInput, workDir: string): Promise<string | null> {
  try {
    if (input.voiceFile) return path.resolve(input.voiceFile);

    if (!input.tts || input.tts.provider === "none" || !input.ttsText) {
      return null;
    }

  const ext = input.tts.format === "wav" ? "wav" : "mp3";
  const outPath = path.join(workDir, `voice.${ext}`);

  if (input.tts.provider === "kokoro") {
    const endpoint = input.tts.endpoint || process.env.KOKORO_TTS_URL;
    if (!endpoint) throw new Error("Kokoro TTS endpoint is not set (opts.tts.endpoint or env KOKORO_TTS_URL)");
    const body = {
      text: input.ttsText,
      voice: input.tts.voice || "default",
      speed: input.tts.speed ?? 1.0,
      format: ext,
    };
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`Kokoro TTS failed: ${resp.status} ${await resp.text()}`);
    const buf = new Uint8Array(await resp.arrayBuffer());
    await fs.writeFile(outPath, buf);
    return outPath;
  }

  // OpenAI TTS
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const payload = {
    model: input.tts.model || "gpt-4o-mini-tts",
    voice: input.tts.voice || "alloy",
    input: input.ttsText,
    format: ext,
  };
  const resp = await fetch(`${baseUrl}/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`OpenAI TTS failed: ${resp.status} ${await resp.text()}`);
  const buf = new Uint8Array(await resp.arrayBuffer());
  await fs.writeFile(outPath, buf);
  return outPath;
  } catch (error: any) {
    log.error(`TTS Error: ${error.message}`);
    throw new Error(`TTS failed: ${error.message}`);
  }
}
