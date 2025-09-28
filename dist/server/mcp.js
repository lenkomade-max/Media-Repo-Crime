import express from "express";
import path from "path";
import fse from "fs-extra";
import { v4 as uuidv4 } from "uuid";
import { storyboardToPlan } from "../storyboard/StoryboardAdapter.js";
import { transcribeWithWhisper } from "../transcribe/Whisper.js";
import { resolveVoiceTrack } from "../audio/TTSService.js";
import { ffprobeJson } from "../utils/ffprobe.js";
let clients = [];
const HEARTBEAT_MS = 15000;
function sendEvent(type, payload) {
    const data = typeof payload === "string" ? payload : JSON.stringify(payload);
    for (const c of clients) {
        try {
            if (!c.res.writableEnded) {
                c.res.write(`event: ${type}\n`);
                c.res.write(`data: ${data}\n\n`);
            }
        }
        catch {
            // игнорируем разорванный сокет
        }
    }
}
/**
 * MCP маршруты:
 *  - /mcp/ping
 *  - /mcp/sse (SSE для n8n Cloud)
 *  - /mcp/montage/plan
 *  - /mcp/subtitles/generate
 *  - /mcp/tts/synthesize
 *  - /mcp/assets/probe
 *  - /mcp/status/:id
 */
export function attachMcpRoutes(app, media) {
    // Health
    app.get("/mcp/ping", (_req, res) => {
        res.json({ ok: true, stage: "v0.3", tools: ["defaults", "plan", "stt", "tts", "probe"] });
    });
    // SSE endpoint с heartbeat
    app.get("/mcp/sse", (req, res) => {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no"); // для nginx/traefik
        res.setHeader("Access-Control-Allow-Origin", "*"); // на всякий случай
        // рекомендуемая задержка реконнекта клиента
        res.write(`retry: 10000\n\n`);
        // мгновенный ping, чтобы прокси «увидели» трафик
        res.write(`: connected ${Date.now()}\n\n`);
        res.flushHeaders?.();
        const clientId = Date.now();
        const heartbeat = setInterval(() => {
            if (!res.writableEnded)
                res.write(`: ping ${Date.now()}\n\n`);
        }, HEARTBEAT_MS);
        const client = { id: clientId, res, heartbeat };
        clients.push(client);
        console.log(`MCP SSE: client ${clientId} connected`);
        req.on("close", () => {
            clearInterval(heartbeat);
            clients = clients.filter((c) => c.id !== clientId);
            console.log(`MCP SSE: client ${clientId} disconnected`);
        });
    });
    // Подписываемся на события очереди — отправляем в SSE
    media.onEnqueue = (jobId) => sendEvent("job", { jobId });
    media.onStatusChange = (_jobId, status) => sendEvent("status", status);
    // Storyboard → PlanInput
    app.post("/mcp/montage/plan", express.json({ limit: "5mb" }), async (req, res) => {
        try {
            const plan = await storyboardToPlan(req.body?.storyboard);
            res.json({ ok: true, plan });
        }
        catch (e) {
            res.status(400).json({ ok: false, error: e?.message || String(e) });
        }
    });
    // STT (Whisper)
    app.post("/mcp/subtitles/generate", express.json({ limit: "2mb" }), async (req, res) => {
        const audioPath = req.body?.audioPath;
        const model = req.body?.model || "base";
        if (!audioPath)
            return res.status(400).json({ error: "audioPath required" });
        try {
            const workDir = path.join("/app/output", `mcp_stt_${uuidv4()}`);
            await fse.ensureDir(workDir);
            const srt = await transcribeWithWhisper(path.resolve(audioPath), workDir, model);
            res.json({ ok: true, srt });
        }
        catch (e) {
            res.status(500).json({ ok: false, error: e?.message || String(e) });
        }
    });
    // TTS
    app.post("/mcp/tts/synthesize", express.json({ limit: "2mb" }), async (req, res) => {
        const tts = req.body?.tts;
        const ttsText = req.body?.ttsText;
        if (!tts || !ttsText)
            return res.status(400).json({ error: "tts and ttsText required" });
        try {
            const workDir = path.join("/app/output", `mcp_tts_${uuidv4()}`);
            await fse.ensureDir(workDir);
            const plan = {
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
            };
            const out = await resolveVoiceTrack(plan, workDir);
            res.json({ ok: true, audio: out });
        }
        catch (e) {
            res.status(500).json({ ok: false, error: e?.message || String(e) });
        }
    });
    // ffprobe
    app.post("/mcp/assets/probe", express.json({ limit: "1mb" }), async (req, res) => {
        const srcPath = req.body?.srcPath;
        if (!srcPath)
            return res.status(400).json({ error: "srcPath required" });
        try {
            const info = await ffprobeJson(path.resolve(srcPath));
            res.json({ ok: true, info });
        }
        catch (e) {
            res.status(500).json({ ok: false, error: e?.message || String(e) });
        }
    });
    // Статус
    app.get("/mcp/status/:id", (req, res) => {
        if (!media)
            return res.status(400).json({ error: "media not attached" });
        const job = media.getJobStatus(req.params.id);
        if (!job)
            return res.status(404).json({ error: "not found" });
        res.json(job);
    });
}
