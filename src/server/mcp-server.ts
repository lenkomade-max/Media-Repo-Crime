
import express from "express";
import { v4 as uuidv4 } from "uuid";
import MediaCreator from "../pipeline/MediaCreator.js";
import path from "path";
import fse from "fs-extra";
import fs from "fs/promises";
import { resolveVoiceTrack } from "../audio/TTSService.js";
import { transcribeWithWhisper } from "../transcribe/Whisper.js";
import { ffprobeJson } from "../utils/ffmpeg.js";
import { PlanInput } from "../types/plan.js";

const app = express();
const media = new MediaCreator();

type SseClient = {
  id: number;
  res: express.Response;
  heartbeat: NodeJS.Timeout;
};
const clients: SseClient[] = [];

function sendEvent(type: string, payload: unknown) {
  const data = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const c of clients) {
    c.res.write(data);
  }
}

// SSE endpoint с корректными заголовками и heartbeat
const HEARTBEAT_INTERVAL = 15000; // 15 секунд
const RETRY_TIMEOUT = 10000; // 10 секунд для reconnect

app.get("/mcp/sse", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Access-Control-Allow-Origin", "*");
  
  // Установка retry timeout для клиента
  res.write(`retry: ${RETRY_TIMEOUT}\n\n`);
  
  // Отправка initial ping для проверки соединения
  res.write(`: ${Date.now()}\n\n`);
  
  res.flushHeaders?.();

  const id = Date.now();
  console.log("MCP SSE: client", id, "connected");

  const heartbeat = setInterval(() => {
    if (!res.writableEnded)
      res.write(`: ping ${Date.now()}\n\n`);
  }, HEARTBEAT_INTERVAL);

  clients.push({ id, res, heartbeat });

  // при подключении — сразу список инструментов
  sendEvent("ready", {
    ok: true,
    stage: "v0.3",
    tools: ["defaults", "plan", "stt", "tts", "probe", "media-video"],
  });

  req.on("close", () => {
    clearInterval(heartbeat);
    const i = clients.findIndex((c) => c.id === id);
    if (i >= 0) clients.splice(i, 1);
    res.end(); // Корректно закрываем соединение
    console.log("MCP SSE: client", id, "disconnected");
  });

  // Обработка ошибок соединения
  req.on("error", (err) => {
    console.error("MCP SSE: client", id, "error:", err);
    clearInterval(heartbeat);
    const i = clients.findIndex((c) => c.id === id);
    if (i >= 0) clients.splice(i, 1);
    res.end();
  });
});

// инструмент media-video
app.post("/mcp/tools/media-video", express.json({ limit: "20mb" }), async (req, res) => {
  try {
    const input = req.body;
    
    // Проверяем есть ли webhook в запросе
    const webhookUrl = input.webhook?.url;
    
    if (webhookUrl) {
      console.log(`🔗 Webhook настроен для задачи: ${webhookUrl}`);
    }
    
    console.log(`📤 Отправляем задачу в Media API...`);
    
    // Отправляем задачу в Media API сервер (порт 4123) через Docker сеть
    const mediaApiUrl = process.env.MEDIA_API_URL || `http://media-video-maker:4123/api/create-video`;
    const response = await fetch(mediaApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input)
    });
    
    if (!response.ok) {
      throw new Error(`Media API ответил: ${response.status}`);
    }
    
    const result = await response.json();
    const jobId = result.id;
    
    console.log(`✅ Задача создана в Media API: ${jobId}`);
    
    // Отправляем SSE событие
    sendEvent("job", { id: jobId, state: "queued" });
    
    res.json({ 
      ok: true, 
      id: jobId, 
      webhookConfigured: !!webhookUrl,
      statusUrl: `http://178.156.142.35:5123/mcp/status/${jobId}`,
      n8nWebhook: webhookUrl ? {
        url: webhookUrl,
        events: ["completed", "error"],
        documentation: "Webhook will be called when job finishes"
      } : null,
      mediaApiStatus: result.status,
      link: `Уже создано в Media API: http://localhost:4123/api/status/${jobId}`
    });
  } catch (e: any) {
    console.log(`❌ Ошибка создания задачи:`, e.message);
    res.status(400).json({ ok: false, error: e?.message || String(e) });
  }
});

// обновления статуса
media.onStatus = (status) => {
  sendEvent("job", status);
};

// получение статуса задачи через Media API
app.get("/mcp/status/:id", async (req, res) => {
  try {
    const jobId = req.params.id;
    console.log(`📋 Получаем статус задачи: ${jobId}`);
    
    // Проверяем статус в Media API через Docker сеть
    const mediaApiStatusUrl = process.env.MEDIA_API_URL?.replace('/api/create-video', '') || `http://media-video-maker:4123/api/status/${jobId}`;
    const response = await fetch(mediaApiStatusUrl);
    
    if (!response.ok) {
      if (response.status === 404) {
        return res.json({ error: "not found" });
      }
      throw new Error(`Media API ответил: ${response.status}`);
    }
    
    const status = await response.json();
    console.log(`✅ Статус получен:`, status.state);
    
    res.json(status);
  } catch (e: any) {
    console.log(`❌ Ошибка получения статуса:`, e.message);
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// ping ручкой
app.get("/mcp/ping", (_req, res) => {
  res.json({
    ok: true,
    stage: "v0.4",
    service: "mcp-server",
    tools: ["defaults", "plan", "stt", "tts", "probe", "media-video"],
    deployed: new Date().toISOString(),
    endpoints: {
      sse: "/mcp/sse",
      n8nInfo: "/mcp/n8n/info",
      createJob: "POST /mcp/tools/media-video"
    }
  });
});

// дополнительные MCP endpoints (stt/tts/probe)
app.post("/mcp/subtitles/generate", express.json({ limit: "2mb" }), async (req, res) => {
  const audioPath: string | undefined = req.body?.audioPath;
  const model: string = req.body?.model || "base";
  if (!audioPath) return res.status(400).json({ error: "audioPath required" });
  try {
    const workDir = path.join("/app/output", `mcp_stt_${uuidv4()}`);
    await fse.ensureDir(workDir);
    const srt = await transcribeWithWhisper(path.resolve(audioPath), workDir, model);
    res.json({ ok: true, srt });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.post("/mcp/tts/synthesize", express.json({ limit: "2mb" }), async (req, res) => {
  const tts = req.body?.tts;
  const ttsText = req.body?.ttsText;
  if (!tts || !ttsText) return res.status(400).json({ error: "tts and ttsText required" });
  try {
    const workDir = path.join("/app/output", `mcp_tts_${uuidv4()}`);
    await fse.ensureDir(workDir);
    const plan: PlanInput = {
      files: [{ id: "x", src: "/dev/null", type: "photo", durationSec: 1 }],
      width: 1080,
      height: 1920,
      fps: 30,
      durationPerPhoto: 1,
      outputFormat: "mp4",
      musicVolumeDb: -8,
      ducking: { enabled: true, musicDuckDb: 8, threshold: 0.05, ratio: 8, attack: 5, release: 250 },
      overlays: [],
      transcribeAudio: false,
      burnSubtitles: false,
      tts,
      ttsText,
    } as any;
    const out = await resolveVoiceTrack(plan, workDir);
    res.json({ ok: true, audio: out });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.post("/mcp/assets/probe", express.json({ limit: "1mb" }), async (req, res) => {
  const srcPath: string | undefined = req.body?.srcPath;
  if (!srcPath) return res.status(400).json({ error: "srcPath required" });
  try {
    const info = await ffprobeJson(path.resolve(srcPath));
    res.json({ ok: true, info });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.get("/mcp/status/:id", (req, res) => {
  const job = media.getJobStatus(req.params.id);
  if (!job) return res.status(404).json({ error: "not found" });
  res.json(job);
});

// тестовый endpoint для проверки деплоя
app.get("/mcp/test", (req, res) => {
  res.json({
    ok: true,
    message: "MCP тест деплоя работает!",
    timestamp: Date.now(),
    version: "v0.4-test",
  });
});

// endpoint для n8n интеграции
app.get("/mcp/n8n/info", (req, res) => {
  res.json({
    name: "Media Video Maker MCP",
    version: "0.4",
    description: "Server-Sent Events for real-time job monitoring",
    endpoints: {
      sse: "/mcp/sse",
      webhook: "/mcp/n8n/webhook/:jobId",
      createJob: "POST /mcp/tools/media-video",
      getStatus: "GET /mcp/status/:id",
      ping: "GET /mcp/ping"
    },
    sseEvents: {
      "ready": "Sent when client connects",
      "job": "Sent when job status changes (queued, running, done, error)",
      "ping": "Sent every 15 seconds to keep connection alive"
    },
    webhookUsage: {
      description: "Webhook endpoint for n8n webhook nodes",
      url: "http://178.156.142.35:5123/mcp/n8n/webhook/WEBHOOK_ID",
      n8nSetup: "1. Create Webhook node\n2. Set webhook path to WEBHOOK_ID\n3. Select 'POST' method\n4. URL will be auto-generated\n5. Use '/mcp/tools/media-video' to create job with webhook"
    },
    exampleUsage: {
      description: "Connect to SSE for real-time updates",
      url: "wss://your-server:5123/mcp/sse",
      javascript: `
const eventSource = new EventSource('http://localhost:5123/mcp/sse');
eventSource.onopen = () => console.log('Connected');
eventSource.onmessage = (event) => console.log('Update:', event.data);
eventSource.addEventListener('job', (event) => {
  const jobData = JSON.parse(event.data);
  console.log('Job update:', jobData);
});`
    }
  });
});

// Webhook endpoint для n8n - получает статус задачи
app.post("/mcp/n8n/webhook/:webhookId", express.json({ limit: "5mb" }), async (req, res) => {
  const webhookId = req.params.webhookId;
  const jobData = req.body;
  
  console.log(`📡 N8N Webhook received for ID: "${webhookId}"`, jobData);
  
  // Логируем запрос от n8n
  try {
    await fs.writeFile(`/app/output/webhook_${webhookId}_${Date.now()}.json`, 
      JSON.stringify({ webhookId, jobData, timestamp: new Date().toISOString() }, null, 2)
    );
  } catch (e: any) {
    console.log("Could not save webhook data:", e?.message || e);
  }
  
  // Отвечаем обратно в n8n
  res.json({
    ok: true,
    webhookId,
    received: true,
    timestamp: new Date().toISOString(),
    data: jobData
  });
});

const PORT = Number(process.env.MCP_PORT) || 5123;
const HOST = process.env.MCP_HOST || "0.0.0.0";

const server = app.listen(PORT, HOST)
  .on("error", (err) => {
    console.error(`Ошибка запуска MCP сервера: ${err}`);
    process.exit(1);
  })
  .on("listening", () => {
    const addr = server.address();
    if (addr && typeof addr === "object") {
      console.log(`🔧 MCP Server запущен на http://${addr.address}:${addr.port}`);
      console.log("Доступные URL:");
      console.log(`- http://localhost:${addr.port}`);
      console.log(`- http://127.0.0.1:${addr.port}`);
      console.log(`- SSE: http://${addr.address}:${addr.port}/mcp/sse`);
    }
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Получен сигнал завершения SIGTERM");
  server.close(() => {
    console.log("MCP сервер остановлен");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("Получен сигнал завершения SIGINT");
  server.close(() => {
    console.log("MCP сервер остановлен");
    process.exit(0);
  });
});

export default app;
