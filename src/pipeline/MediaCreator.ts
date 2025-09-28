import fs from "fs/promises";
import path from "path";
import fse from "fs-extra";
import * as uuid from "uuid";
import { runFFmpeg } from "../utils/ffmpeg.js";
import { PlanInput, PlanInputSchema, JobStatus } from "../types/plan.js";
import { buildSlidesVideo } from "./ConcatPlanBuilder.js";
import { resolveVoiceTrack } from "../audio/TTSService.js";
import { transcribeWithWhisper } from "../transcribe/Whisper.js";
import { buildAudioFilter } from "../audio/AudioMixer.js";

const uuidv4 = uuid.v4;

type QueueItem = { id: string; input: PlanInput };

export default class MediaCreator {
  private queue: QueueItem[] = [];
  private running = false;
  private statuses = new Map<string, JobStatus>();

  /** колбэк для SSE */
  public onStatus?: (status: JobStatus) => void;

  enqueueJob(input: PlanInput) { return this.enqueue(input); }
  getJobStatus(id: string) { return this.statuses.get(id); }

  enqueue(input: PlanInput) {
    const parsed = PlanInputSchema.parse(input);
    const id = uuidv4();
    const status: JobStatus = { id, state: "queued", progress: 0 };
    this.statuses.set(id, status);
    this.onStatus?.(status);
    this.queue.push({ id, input: parsed });
    this.pump();
    return id;
  }

  private async pump() {
    if (this.running) return;
    const item = this.queue.shift();
    if (!item) return;
    this.running = true;
    try {
      let status: JobStatus = { id: item.id, state: "running", progress: 0, message: "init" };
      this.statuses.set(item.id, status);
      this.onStatus?.(status);

      const out = await this.process(item.id, item.input);

      status = { id: item.id, state: "done", output: out.output, srt: out.srt, vtt: out.vtt };
      this.statuses.set(item.id, status);
      this.onStatus?.(status);
    } catch (e: any) {
      const status: JobStatus = { id: item.id, state: "error", error: e?.message || String(e) };
      this.statuses.set(item.id, status);
      this.onStatus?.(status);
    } finally {
      this.running = false;
      this.pump();
    }
  }

  private async process(id: string, input: PlanInput): Promise<{ output: string; srt?: string; vtt?: string }> {
    const workRoot = "/app/output";
    const workDir = path.join(workRoot, `job_${id}`);
    await fse.ensureDir(workDir);

    // 1) Сборка слайдов
    const slidesPath = await buildSlidesVideo(input, workDir);

    // 2) Озвучка
    let voicePath: string | null = null;
    try {
      voicePath = await resolveVoiceTrack(input, workDir);
    } catch {
      voicePath = null;
    }

    // 3) Субтитры
    let srtPath: string | undefined;
    if (input.transcribeAudio && voicePath) {
      try {
        srtPath = await transcribeWithWhisper(voicePath, workDir, "base");
      } catch (e: any) {
        throw new Error(`Whisper failed: ${e?.message || e}`);
      }
    }

    // 4) Сборка финального ролика
    const outPath = path.join(workRoot, `video_${id}.${input.outputFormat}`);
    const args: string[] = ["-y", "-i", slidesPath];

    const hasMusic = !!input.music;
    const hasVoice = !!voicePath;
    if (hasMusic) args.push("-i", path.resolve(input.music!));
    if (hasVoice) args.push("-i", voicePath!);

    const { chain, finalLabel } = buildAudioFilter({
      hasMusic,
      hasVoice,
      musicVolumeDb: input.musicVolumeDb ?? -6,
      ducking: input.ducking,
      musicInLabel: hasMusic ? "[1:a]" : "",
      voiceInLabel: hasVoice ? "[2:a]" : "",
    });
    if (chain) args.push("-filter_complex", chain);

    if (input.burnSubtitles && srtPath) {
      args.push("-vf", `subtitles='${srtPath.replace(/:/g, "\\:")}'`);
    }

    args.push("-map", "0:v:0");
    if (finalLabel) {
      if (finalLabel.includes(":")) {
        args.push("-map", finalLabel);
      } else {
        args.push("-map", `${finalLabel}`);
      }
      args.push("-c:a", "aac", "-b:a", "192k");
    } else if (hasMusic) {
      args.push("-map", "1:a:0", "-c:a", "aac", "-b:a", "192k");
    }

    args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(input.fps));
    args.push("-shortest");
    args.push(outPath);

    await runFFmpeg(args, workDir);

    return { output: outPath, srt: srtPath, vtt: undefined };
  }
}
