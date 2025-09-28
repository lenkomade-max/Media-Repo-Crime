import path from "path";
import fse from "fs-extra";
import * as uuid from "uuid";
import { runFFmpeg } from "../utils/ffmpeg.js";
import { PlanInputSchema } from "../types/plan.js";
import { buildSlidesVideo } from "./ConcatPlanBuilder.js";
import { resolveVoiceTrack } from "../audio/TTSService.js";
import { transcribeWithWhisper } from "../transcribe/Whisper.js";
import { buildAudioFilter } from "../audio/AudioMixer.js";
import { buildEffectsFilter } from "../effects/EffectsProcessor.js";
import { buildVideoOverlayFilter, buildForceStyle } from "../overlays/OverlayRenderer.js";
const uuidv4 = uuid.v4;
export default class MediaCreator {
    queue = [];
    running = false;
    statuses = new Map();
    /** хуки для SSE */
    onEnqueue;
    onStatusChange;
    enqueueJob(input) { return this.enqueue(input); }
    getJobStatus(id) { return this.statuses.get(id); }
    enqueue(input) {
        const parsed = PlanInputSchema.parse(input);
        const id = uuidv4();
        const job = { id, state: "queued", progress: 0 };
        this.statuses.set(id, job);
        this.queue.push({ id, input: parsed });
        this.onEnqueue?.(id);
        this.onStatusChange?.(id, job);
        this.pump();
        return id;
    }
    async pump() {
        if (this.running)
            return;
        const item = this.queue.shift();
        if (!item)
            return;
        this.running = true;
        try {
            const runningStatus = { id: item.id, state: "running", progress: 0, message: "init" };
            this.statuses.set(item.id, runningStatus);
            this.onStatusChange?.(item.id, runningStatus);
            const out = await this.process(item.id, item.input);
            const doneStatus = { id: item.id, state: "done", output: out.output, srt: out.srt, vtt: out.vtt };
            this.statuses.set(item.id, doneStatus);
            this.onStatusChange?.(item.id, doneStatus);
        }
        catch (e) {
            const errStatus = { id: item.id, state: "error", error: e?.message || String(e) };
            this.statuses.set(item.id, errStatus);
            this.onStatusChange?.(item.id, errStatus);
        }
        finally {
            this.running = false;
            this.pump();
        }
    }
    async process(id, input) {
        const workRoot = "/app/output";
        const workDir = path.join(workRoot, `job_${id}`);
        await fse.ensureDir(workDir);
        // 1) Сборка слайдов
        const slidesPath = await buildSlidesVideo(input, workDir);
        // 2) Эффекты
        const fx = buildEffectsFilter(input, "[0:v]");
        // 3) Голос
        let voicePath = null;
        try {
            voicePath = await resolveVoiceTrack(input, workDir);
        }
        catch {
            voicePath = null;
        }
        // 4) Сабы
        let srtPath;
        if (input.transcribeAudio && voicePath) {
            srtPath = await transcribeWithWhisper(voicePath, workDir, "base");
        }
        // 5) Входы ffmpeg
        const args = ["-y", "-i", slidesPath];
        let inputIdx = 1;
        const hasMusic = !!input.music;
        const hasVoice = !!voicePath;
        let musicLabel = "";
        let voiceLabel = "";
        if (hasMusic) {
            args.push("-i", path.resolve(input.music));
            musicLabel = `[${inputIdx++}:a]`;
        }
        if (hasVoice) {
            args.push("-i", voicePath);
            voiceLabel = `[${inputIdx++}:a]`;
        }
        // 6) Стили сабов + оверлеи
        const subStyle = buildForceStyle(input.subtitleStyle || undefined);
        const vOverlay = await buildVideoOverlayFilter(input, workDir, fx.finalLabel || "[0:v]", srtPath, subStyle);
        // 7) Доп. входы (если нужны)
        const shapeStartIndex = inputIdx;
        for (const p of vOverlay.extraInputs) {
            args.push("-i", p);
            inputIdx++;
        }
        // 8) filter_complex
        let videoFilter = vOverlay.filter;
        for (let i = 0; i < vOverlay.extraInputs.length; i++) {
            const real = `[${shapeStartIndex + i}:v]`;
            videoFilter = videoFilter.replaceAll(`[SH${i}:v]`, real);
        }
        const { chain: audioChain, finalLabel: audioOut } = buildAudioFilter({
            hasMusic,
            hasVoice,
            musicVolumeDb: input.musicVolumeDb ?? -6,
            ducking: input.ducking,
            musicInLabel: musicLabel || "[1:a]",
            voiceInLabel: voiceLabel || "[2:a]",
        });
        const filterChains = [];
        if (fx.filter)
            filterChains.push(fx.filter);
        if (videoFilter)
            filterChains.push(videoFilter);
        if (audioChain)
            filterChains.push(audioChain);
        if (filterChains.length)
            args.push("-filter_complex", filterChains.join(";"));
        // 9) map
        args.push("-map", vOverlay.finalLabel || fx.finalLabel || "0:v:0");
        if (audioOut) {
            args.push("-map", audioOut, "-c:a", "aac", "-b:a", "192k");
        }
        else if (hasMusic) {
            args.push("-map", musicLabel.replace(/]$/, "") + "]", "-c:a", "aac", "-b:a", "192k");
        }
        // 10) кодек/частота
        args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(input.fps));
        // 11) по кратчайшему
        args.push("-shortest");
        // 12) вывод
        const outPath = path.join(workRoot, `video_${id}.${input.outputFormat}`);
        args.push(outPath);
        await runFFmpeg(args, workDir);
        return { output: outPath, srt: srtPath, vtt: undefined };
    }
}
