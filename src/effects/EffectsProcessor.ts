import type { EffectItem, PlanInput } from "../types/plan.js";

/**
 * Собирает видео-эффекты в цепочку ffmpeg для -filter_complex.
 */
export function buildEffectsFilter(
  input: PlanInput,
  baseLabel = "[0:v]"
): { filter: string; finalLabel: string } {
  const effs: EffectItem[] = input.effects || [];
  if (!effs.length) return { filter: "", finalLabel: baseLabel };

  const W = input.width;
  const H = input.height;

  let current = baseLabel;
  const chains: string[] = [];
  let step = 0;

  for (const e of effs) {
    step++;
    const out = `[vfx_${step}]`;

    if (e.kind === "zoom") {
      const { startSec: ts = 0, endSec: te = 0, params } = e;
      const { startScale = 1.0, endScale = 1.2, cx = 0.5, cy = 0.5 } = params;

      const Z = `if(lt(t,${ts}),${startScale},if(gt(t,${te}),${endScale},${startScale}+(${endScale}-${startScale})*(t-${ts})/max(${te}-${ts},0.001)))`;
      const xExpr = `max(0,(${cx}*in_w - ${W}/2))`;
      const yExpr = `max(0,(${cy}*in_h - ${H}/2))`;

      chains.push(`${current}scale=iw*${Z}:ih*${Z},crop=${W}:${H}:${xExpr}:${yExpr}${out}`);
      current = out;
      continue;
    }

    if (e.kind === "vhs") {
      const { startSec: ts = 0, endSec: te = 0, params = {} as any } = e;
      const noise = Math.max(0, Math.min(100, params.noise ?? 20));
      const chroma = Math.max(0, Math.min(5, params.chroma ?? 2));
      const contrast = params.contrast ?? 1.05;
      const saturation = params.saturation ?? 1.15;

      chains.push(
        `${current}format=yuv420p,` +
        `eq=contrast=${contrast}:saturation=${saturation}:enable='between(t,${ts},${te})',` +
        `noise=alls=${noise}:allf=t:enable='between(t,${ts},${te})',` +
        `chromashift=cx=${chroma}:cy=${Math.max(0, Math.min(3, chroma - 1))}:enable='between(t,${ts},${te})'${out}`
      );
      current = out;
      continue;
    }

    if (e.kind === "retro") {
      const { startSec: ts = 0, endSec: te = 0, params = {} as any } = e;
      const vignette = params.vignette ?? Math.PI / 5;
      const grain = Math.max(0, params.grain ?? 5);
      const saturation = params.saturation ?? 0.95;
      const contrast = params.contrast ?? 1.05;
      const gamma = params.gamma ?? 0.98;

      chains.push(
        `${current}eq=saturation=${saturation}:contrast=${contrast}:gamma=${gamma}:enable='between(t,${ts},${te})',` +
        `vignette=angle=${vignette}:enable='between(t,${ts},${te})',` +
        `noise=alls=${grain}:allf=t:enable='between(t,${ts},${te})'${out}`
      );
      current = out;
      continue;
    }

    if (e.kind === "custom") {
      const { startSec: ts = 0, endSec: te = 0, filter } = e;
      let filt = filter;
      if (!/enable=/.test(filt)) {
        filt = `${filt}:enable='between(t,${ts},${te})'`;
      }
      chains.push(`${current}${filt}${out}`);
      current = out;
      continue;
    }
  }

  step++;
  const final = `[vfx_${step}]`;
  chains.push(`${current}format=yuv420p${final}`);

  return { filter: chains.join(";"), finalLabel: final };
}
