
import express from "express";
import { v4 as uuidv4 } from "uuid";
import MediaCreator from "../pipeline/MediaCreator.js";
import path from "path";
import fse from "fs-extra";
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

// SSE
app.get("/mcp/sse", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.write("retry: 10000\n\n");
  res.flushHeaders?.();

  const id = Date.now();
  console.log("MCP SSE: client", id, "connected");

  const heartbeat = setInterval(() => {
    if (!res.writableEnded)
      res.write(`: ping ${Date.now()}\n\n`);
  }, 15000);

  clients.push({ id, res, heartbeat });

  sendEvent("ready", {
    ok: true,
    stage: "v0.3",
    tools: ["defaults", "plan", "stt", "tts", "probe", "media-video"],
  });

  req.on("close", () => {
    clearInterval(heartbeat);
    const i = clients.findIndex((c) => c.id === id);
    if (i >= 0) clients.splice(i, 1);
    console.log("MCP SSE: client", id, "disconnected");
  });
});

// инструмент media-video
app.post("/mcp/tools/media-video", express.json({ limit: "20mb" }), async (req, res) => {
  try {
    const id = media.enqueueJob(req.body);
    sendEvent("job", { id, state: "queued" });
    res.json({ ok: true, id });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message || String(e) });
  }
});

// обновления статуса
media.onStatus = (status) => {
  sendEvent("job", status);
};

// ping ручкой
app.get("/mcp/ping", (_req, res) => {
  res.json({
    ok: true,
    stage: "v0.3",
    tools: ["defaults", "plan", "stt", "tts", "probe", "media-video"],
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

const PORT = process.env.PORT || 5123;
app.listen(PORT, () => {
  console.log(`MCP server listening on port ${PORT}`);
});
