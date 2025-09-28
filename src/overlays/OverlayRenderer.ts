import { PlanInput, OverlayItem, SubtitleStyle } from "../types/plan.js";

/**
 * Генерация force_style строк для сабов ASS (libass)
 */
export function buildForceStyle(style?: SubtitleStyle): string {
  if (!style) return "";

  const parts: string[] = [];

  if (style.font) parts.push(`FontName=${style.font}`);
  if (style.size) parts.push(`FontSize=${style.size}`);
  if (style.color) parts.push(`PrimaryColour=${style.color}`);
  if (style.background) parts.push(`BackColour=${style.background}`);
  if (style.outline) {
    if (style.outline.width) parts.push(`Outline=${style.outline.width}`);
    if (style.outline.color) parts.push(`OutlineColour=${style.outline.color}`);
  }
  if (style.alignment) {
    parts.push(`Alignment=${style.alignment === "top" ? 8 : 2}`);
  }
  if (style.marginV) {
    parts.push(`MarginV=${style.marginV}`);
  }

  return parts.join(",");
}

/**
 * Генерация оверлеев (текст, прямоугольник, круг, стрелка)
 */
export async function buildVideoOverlayFilter(
  input: PlanInput,
  workDir: string,
  baseLabel: string,
  srtPath?: string,
  subStyle?: string
): Promise<{ filter: string; finalLabel: string; extraInputs: string[] }> {
  const overlays: OverlayItem[] = input.overlays || [];
  let current = baseLabel;
  let step = 0;
  const chains: string[] = [];
  const extraInputs: string[] = [];

  // Сабтайтлы
  if (input.burnSubtitles && srtPath) {
    let vf = `subtitles='${srtPath.replace(/:/g, "\\:")}'`;
    if (subStyle && subStyle.length > 0) {
      vf += `:force_style='${subStyle}'`;
    }
    step++;
    const out = `[ovl_${step}]`;
    chains.push(`${current}${vf}${out}`);
    current = out;
  }

  for (const o of overlays) {
    step++;
    const out = `[ovl_${step}]`;

    if (o.target === "top" || o.target === "bottom") {
      const text = o.text?.replace(/:/g, "\\:").replace(/'/g, "\\'") ?? "";
      const font = o.style?.font || "DejaVu Sans";
      const size = o.style?.size || 32;
      const color = o.style?.color || "white";
      const bg = o.style?.background ? `box=1:boxcolor=${o.style.background}` : "";
      const outline = o.style?.outlineWidth ? `borderw=${o.style.outlineWidth}` : "borderw=2";

      const y = o.target === "top" ? 20 : "(h-text_h-20)";
      const draw = `drawtext=text='${text}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:font=${font}:fontsize=${size}:fontcolor=${color}:${bg}:${outline}:x=(w-text_w)/2:y=${y}`;
      chains.push(`${current}${draw}${out}`);
      current = out;
      continue;
    }

    if (o.target === "rect") {
      const shape = o.shape as { w: number; h: number; color?: string; thickness?: number; fillOpacity?: number };
      if (shape?.w && shape?.h) {
        const { x = 0, y = 0 } = o.position || {};
        const { w, h, color = "red", thickness = 4, fillOpacity = 0.0 } = shape;
        const draw = `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${color}@${fillOpacity}:t=${thickness}`;
        chains.push(`${current}${draw}${out}`);
        current = out;
      }
      continue;
    }

    if (o.target === "circle") {
      const shape = o.shape as { radius: number; color?: string; thickness?: number; fillOpacity?: number };
      if (shape?.radius) {
        const { x = 100, y = 100 } = o.position || {};
        const { radius, color = "blue", thickness = 4, fillOpacity = 0.0 } = shape;
        const draw = `drawcircle=x=${x}:y=${y}:r=${radius}:color=${color}@${fillOpacity}:t=${thickness}`;
        chains.push(`${current}${draw}${out}`);
        current = out;
      }
      continue;
    }

    if (o.target === "arrow") {
      const shape = o.shape as { x1: number; y1: number; x2: number; y2: number; color?: string; thickness?: number };
      if (shape?.x1 !== undefined && shape?.y1 !== undefined) {
        const { x1, y1, x2, y2, color = "yellow", thickness = 4 } = shape;
        const draw = `drawline=x1=${x1}:y1=${y1}:x2=${x2}:y2=${y2}:color=${color}:thickness=${thickness}`;
        chains.push(`${current}${draw}${out}`);
        current = out;
      }
      continue;
    }
  }

  step++;
  const final = `[ovl_${step}]`;
  chains.push(`${current}format=yuv420p${final}`);

  return { filter: chains.join(";"), finalLabel: final, extraInputs };
}
