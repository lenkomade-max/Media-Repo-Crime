import fs from "fs/promises";
import path from "path";
import { loadDefaults } from "../config/Defaults.js";
import { parseColor, toFFColor } from "../utils/color.js";
import { drawRectPNG, drawCirclePNG, drawArrowPNG } from "./ShapesRenderer.js";
/**
 * Собирает видео-цепочку (subtitles + overlays) для -filter_complex.
 * Возвращает filter, finalLabel и список PNG-инпутов (их добавить как -i ...).
 */
export async function buildVideoOverlayFilter(input, workDir, baseVideoLabel = "[0:v]", srtPath, subtitlesForceStyle) {
    const defs = await loadDefaults();
    const width = input.width ?? defs.canvas.width;
    const height = input.height ?? defs.canvas.height;
    const safe = Math.max(0, Math.min(0.15, defs.canvas.safeAreaPct ?? 0.05));
    const fontFile = process.env.FONT_FILE ||
        defs.paths.fontFile ||
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
    const overlays = input.overlays || [];
    const chains = [];
    let current = baseVideoLabel;
    let step = 0;
    const extraInputs = [];
    // 0) Subtitles burn-in (если есть srt)
    if (input.burnSubtitles && srtPath) {
        step++;
        const out = `[v${step}]`;
        const srtEsc = srtPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
        const fsEsc = (subtitlesForceStyle || "").replace(/'/g, "\\'");
        chains.push(`${current}subtitles='${srtEsc}':force_style='${fsEsc}'${out}`);
        current = out;
    }
    // helper: текст через textfile (без плясок с экранированием)
    async function writeTextFile(prefix, text) {
        const p = path.join(workDir, `${prefix}_${step}.txt`);
        await fs.writeFile(p, text.replace(/\r/g, ""), "utf8");
        return p;
    }
    // позиционирование
    function posFor(target, item, sizePx) {
        if (target === "top") {
            const y = Math.round(height * safe + 10);
            const x = "(w-text_w)/2";
            return { x, y };
        }
        if (target === "bottom") {
            const y = `h - text_h - ${Math.round(height * safe + 10)}`;
            const x = "(w-text_w)/2";
            return { x, y };
        }
        // custom
        const px = item.position?.x ?? Math.round(width * 0.5);
        const py = item.position?.y ?? Math.round(height * 0.1);
        return { x: String(px), y: String(py) };
    }
    // 1) Текстовые оверлеи
    for (const ov of overlays.filter((o) => ["top", "bottom", "custom"].includes(o.target))) {
        if (!ov.text)
            continue;
        step++;
        const out = `[v${step}]`;
        const start = ov.startSec ?? 0;
        const end = ov.endSec ?? start + 5;
        const style = ov.style ||
            (ov.target === "top"
                ? defs.overlayTop
                : ov.target === "bottom"
                    ? defs.overlayBottom
                    : defs.overlayTop);
        const fontcolor = toFFColor(parseColor(style.color || "#FFFFFF"));
        const bg = toFFColor(parseColor(style.background || "rgba(0,0,0,0.35)"));
        const size = style.size ?? (ov.target === "top" ? 44 : 36);
        const outline = Math.max(0, style.outlineWidth ?? 2);
        const { x, y } = posFor(ov.target, ov, size);
        const textFile = await writeTextFile(`overlay_text`, ov.text);
        const expr = `drawtext=fontfile='${fontFile}':textfile='${textFile}':fontsize=${size}:fontcolor=${fontcolor}:` +
            `box=1:boxcolor=${bg}:borderw=${outline}:x=${x}:y=${y}:enable='between(t,${start},${end})'`;
        chains.push(`${current}${expr}${out}`);
        current = out;
    }
    // 2) Фигуры (rect/circle/arrow) как PNG
    for (const ov of overlays.filter((o) => ["rect", "circle", "arrow"].includes(o.target))) {
        step++;
        const out = `[v${step}]`;
        const start = ov.startSec ?? 0;
        const end = ov.endSec ?? start + 3;
        if (ov.target === "rect") {
            const sh = ov.shape || {};
            const w = Math.max(2, sh.w ?? 300);
            const h = Math.max(2, sh.h ?? 120);
            const color = parseColor(sh.color || "#FF4D4F");
            const thickness = Math.max(0, sh.thickness ?? 6);
            const fillOpacity = Math.max(0, Math.min(1, sh.fillOpacity ?? 0.15));
            const png = path.join(workDir, `shape_rect_${step}.png`);
            await drawRectPNG(png, w, h, thickness, color, fillOpacity);
            extraInputs.push(png);
            const x = ov.position?.x ?? Math.round((width - w) / 2);
            const y = ov.position?.y ?? Math.round(height * safe + 10);
            const idx = extraInputs.length - 1;
            chains.push(`${current}[SH${idx}:v]overlay=${x}:${y}:enable='between(t,${start},${end})'${out}`);
            current = out;
        }
        if (ov.target === "circle") {
            const sh = ov.shape || {};
            const radius = Math.max(5, sh.radius ?? 56);
            const color = parseColor(sh.color || "#4D9EFF");
            const thickness = Math.max(0, sh.thickness ?? 6);
            const fillOpacity = Math.max(0, Math.min(1, sh.fillOpacity ?? 0.0));
            const png = path.join(workDir, `shape_circle_${step}.png`);
            await drawCirclePNG(png, radius, thickness, color, fillOpacity);
            extraInputs.push(png);
            const cx = ov.position?.x ?? Math.round(width / 2);
            const cy = ov.position?.y ?? Math.round(height / 2);
            const x = cx - radius;
            const y = cy - radius;
            const idx = extraInputs.length - 1;
            chains.push(`${current}[SH${idx}:v]overlay=${x}:${y}:enable='between(t,${start},${end})'${out}`);
            current = out;
        }
        if (ov.target === "arrow") {
            const sh = ov.shape;
            const color = parseColor(sh.color || "#FFD400");
            const thickness = Math.max(1, sh.thickness ?? 6);
            const headSize = Math.max(6, sh.headSize ?? 18);
            const minX = Math.min(sh.x1, sh.x2);
            const minY = Math.min(sh.y1, sh.y2);
            const w = Math.max(1, Math.abs(sh.x2 - sh.x1)) + headSize * 2;
            const h = Math.max(1, Math.abs(sh.y2 - sh.y1)) + headSize * 2;
            const png = path.join(workDir, `shape_arrow_${step}.png`);
            await drawArrowPNG(png, w, h, sh.x1 - minX + headSize, sh.y1 - minY + headSize, sh.x2 - minX + headSize, sh.y2 - minY + headSize, thickness, headSize, color);
            extraInputs.push(png);
            const x = minX - headSize;
            const y = minY - headSize;
            const idx = extraInputs.length - 1;
            chains.push(`${current}[SH${idx}:v]overlay=${x}:${y}:enable='between(t,${start},${end})'${out}`);
            current = out;
        }
    }
    // совместимость: если кто-то уже пишет input.effects — пока игнорируем
    if (Array.isArray(input.effects) && input.effects.length > 0) {
        // TODO (Этап 3): эффекты zoom/VHS/retro
    }
    // финальный вид
    step++;
    const final = `[vout_${step}]`;
    chains.push(`${current}format=yuv420p${final}`);
    return { filter: chains.join(";"), finalLabel: final, extraInputs };
}
