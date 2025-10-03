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
  const startTime = Date.now();
  
  try {
    // Детальные логи входных параметров
    log.info(`🎤 TTS Start: provider=${input.tts?.provider}, text=${input.ttsText?.length || 0}chars, voice=${input.tts?.voice || 'default'}`);
    
    if (input.voiceFile) {
      log.info(`🎤 Using existing voice file: ${input.voiceFile}`);
      return path.resolve(input.voiceFile);
    }

    // Жёсткая валидация входа: использовать ttsText (корень плана), а не tts.text
    if (!input.tts || input.tts.provider === "none" || !input.ttsText) {
      log.info(`🎤 TTS skipped: provider=${input.tts?.provider}, ttsText=${!!input.ttsText}`);
      return null;
    }

    // Проверка наличия текста - явная ошибка если нет
    if (!input.ttsText || input.ttsText.trim().length === 0) {
      throw new Error("TTS text is empty or missing - use 'ttsText' field in plan root");
    }

    const ext = input.tts.format === "wav" ? "wav" : "mp3";
    const outPath = path.join(workDir, `voice.${ext}`);

    if (input.tts.provider === "kokoro") {
      // Централизованное чтение KOKORO_TTS_URL
      const endpoint = input.tts.endpoint || process.env.KOKORO_TTS_URL;
      if (!endpoint) {
        throw new Error("Kokoro TTS endpoint is not set (opts.tts.endpoint or env KOKORO_TTS_URL)");
      }

      const body = {
        text: input.ttsText,
        voice: input.tts.voice || "default",
        speed: input.tts.speed ?? 1.0,
        format: ext,
      };

      log.info(`🎤 Kokoro TTS request: url=${endpoint}, body=${JSON.stringify(body)}`);
      
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      log.info(`🎤 Kokoro TTS response: status=${resp.status}, ok=${resp.ok}, content-length=${resp.headers.get('content-length') || 'unknown'}`);

      // Обязательная проверка результата TTS
      if (!resp.ok) {
        const errorText = await resp.text();
        log.error(`🎤 Kokoro TTS failed: ${resp.status} ${errorText}`);
        throw new Error(`Kokoro TTS failed: ${resp.status} ${errorText}`);
      }

      const buf = new Uint8Array(await resp.arrayBuffer());
      
      // Проверка на пустой буфер
      if (buf.length === 0) {
        log.error(`🎤 Kokoro TTS returned empty buffer (0 bytes)`);
        throw new Error("Kokoro TTS returned empty audio data");
      }
      
      log.info(`🎤 Kokoro TTS buffer: ${buf.length} bytes`);
      
      await fs.writeFile(outPath, buf);
      log.info(`🎤 Kokoro TTS success: ${outPath} (${Date.now() - startTime}ms)`);
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

    const url = `${baseUrl}/audio/speech`;
    log.info(`🎤 OpenAI TTS request: url=${url}, model=${payload.model}, voice=${payload.voice}, input=${payload.input.length}chars`);

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });

    log.info(`🎤 OpenAI TTS response: status=${resp.status}, ok=${resp.ok}, content-length=${resp.headers.get('content-length') || 'unknown'}`);

    // Обязательная проверка результата TTS
    if (!resp.ok) {
      const errorText = await resp.text();
      log.error(`🎤 OpenAI TTS failed: ${resp.status} ${errorText}`);
      throw new Error(`OpenAI TTS failed: ${resp.status} ${errorText}`);
    }

    const buf = new Uint8Array(await resp.arrayBuffer());
    
    // Проверка на пустой буфер
    if (buf.length === 0) {
      log.error(`🎤 OpenAI TTS returned empty buffer (0 bytes)`);
      throw new Error("OpenAI TTS returned empty audio data");
    }

    log.info(`🎤 OpenAI TTS buffer: ${buf.length} bytes`);
    
    await fs.writeFile(outPath, buf);
    log.info(`🎤 OpenAI TTS success: ${outPath} (${Date.now() - startTime}ms)`);
    return outPath;
  } catch (error: any) {
    log.error(`🎤 TTS Error (${Date.now() - startTime}ms): ${error.message}`);
    throw new Error(`TTS failed: ${error.message}`);
  }
}
