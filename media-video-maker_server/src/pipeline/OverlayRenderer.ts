import fs from "fs/promises";
import path from "path";
import type { PlanInput, Overlay, EffectItem } from "../types/plan.js";
import { loadDefaults } from "../config/Defaults.js";
import { parseColor, toFFColor } from "../utils/color.js";
import * as Shapes from "./ShapesRenderer.js";
import { VideoOverlayRenderer } from "./VideoOverlayRenderer.js";
// LUT удалён согласно плану

/**
 * Собирает видео-цепочку (subtitles + overlays) для -filter_complex.
 * Возвращает filter, finalLabel и список PNG-инпутов (их добавить как -i ...).
 */
export async function buildVideoOverlayFilter(
  input: PlanInput,
  workDir: string,
  baseVideoLabel = "[0:v]",
  srtPath?: string,
  subtitlesForceStyle?: string,
  musicInputs: number = 0
): Promise<{ filter: string; finalLabel: string; extraInputs: string[] }> {
  const defs = await loadDefaults();
  const width = input.width ?? defs.canvas.width;
  const height = input.height ?? defs.canvas.height;
  const safe = Math.max(0, Math.min(0.15, defs.canvas.safeAreaPct ?? 0.05));
  const fontFile =
    process.env.FONT_FILE ||
    defs.paths.fontFile ||
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";

  const overlays: Overlay[] = (input.overlays as Overlay[]) || [];
  const chains: string[] = [];
  let current = baseVideoLabel;
  let step = 0;
  const extraInputs: string[] = [];

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
  async function writeTextFile(prefix: string, text: string) {
    const p = path.join(workDir, `${prefix}_${step}.txt`);
    await fs.writeFile(p, text.replace(/\r/g, ""), "utf8");
    return p;
  }

  // позиционирование
  function posFor(target: string, item: Overlay, sizePx: number) {
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

  // 1) СНАЧАЛА ПРИМЕНЯЕМ VIDEO OVERLAYS (VHS эффекты как видео файлы)
  const videoOverlayResult = await VideoOverlayRenderer.buildVideoOverlayFilter(
    input,
    current,
    workDir,
    musicInputs
  );
  
  if (videoOverlayResult.filter) {
    // Добавляем video overlay файлы в extraInputs
    extraInputs.push(...videoOverlayResult.extraInputs);
    chains.push(videoOverlayResult.filter);
    current = videoOverlayResult.finalLabel;
  }

  // 2) СТАРЫЕ ЭФФЕКТЫ ОТКЛЮЧЕНЫ - теперь используем video overlays
  // if (Array.isArray((input as any).effects) && (input as any).effects.length > 0) {
  //   for (const effect of (input as any).effects) {
  //     const effectFilter = buildEffectFilter(effect, (input as any).durationSec || 0);
  //     if (effectFilter) {
  //       step++;
  //       const out = `[vfx_${step}]`;
  //       chains.push(`${current}${effectFilter}${out}`);
  //       current = out;
  //     }
  //   }
  // }

  // 2.5) LUT ЦВЕТОКОРРЕКЦИЯ УДАЛЕНА согласно плану

  // 3) ЗАТЕМ НАКЛАДЫВАЕМ ТЕКСТОВЫЕ ОВЕРЛЕИ ПОВЕРХ VIDEO OVERLAYS
  for (const ov of overlays.filter((o) =>
    ["top", "bottom", "custom"].includes(o.target as string)
  )) {
    if (!ov.text) continue;
    step++;
    const out = `[v${step}]`;
    const start = (ov as any).startSec ?? 0;
    const end = (ov as any).endSec ?? start + 5;
    const duration = end - start;
    const style = (ov as any).style || {};
    const animation = (ov as any).animation || {};

    // Расширенные стили v2
    const fontWeight = style.fontWeight || "bold";
    const textTransform = style.textTransform || (ov.target === "top" ? "uppercase" : "none");
    const colors = style.colors || {};
    const backgroundStyle = style.backgroundStyle || {};
    
    // Цвета
    const primaryColor = colors.primary || style.color || "#FFFFFF";
    const fontcolor = toFFColor(parseColor(primaryColor));
    
    // Фон с улучшенными стилями
    const bgColor = backgroundStyle.color || style.background || "rgba(0,0,0,0.8)";
    const bg = toFFColor(parseColor(bgColor));
    const borderRadius = backgroundStyle.borderRadius || 8;
    const padding = backgroundStyle.padding || (ov.target === "top" ? 20 : 15);
    
    // Размер шрифта
    const size = style.size ?? (ov.target === "top" ? 48 : 36);
    const outline = Math.max(0, style.outlineWidth ?? 3);

    const { x, y } = posFor(ov.target as string, ov, size);
    
    // Преобразование текста
    let displayText = ov.text!;
    if (textTransform === "uppercase") displayText = displayText.toUpperCase();
    else if (textTransform === "lowercase") displayText = displayText.toLowerCase();
    
    const textFile = await writeTextFile(`overlay_text_${step}`, displayText);

    // Анимация: сохраняем typewriter/fade, но без тяжёлых выражений
    let animExpr = "";
    if (animation.type === "typewriter" && duration > 2) {
      const wordsPerSec = animation.wordsPerSecond || 3;
      const totalWords = displayText.split(' ').length;
      const typewriterDuration = Math.min(duration * 0.7, totalWords / wordsPerSec);
      animExpr = `:alpha=if(lt(t,${start + typewriterDuration}),min(1,(t-${start})/${typewriterDuration}),1)`;
    } else if (duration > 2) {
      const fadeInTime = Math.min(0.6, Math.max(0.2, duration * 0.12));
      const fadeOutTime = Math.min(0.6, Math.max(0.2, duration * 0.12));
      const fadeInEnd = start + fadeInTime;
      const fadeOutStart = end - fadeOutTime;
      animExpr = `:alpha=if(lt(t,${fadeInEnd}),(t-${start})/${fadeInTime},if(gt(t,${fadeOutStart}),(${end}-t)/${fadeOutTime},1))`;
    }

    // Улучшенное форматирование с padding
    const expr =
      `drawtext=fontfile='${fontFile}':textfile='${textFile}':fontsize=${size}:fontcolor=${fontcolor}:` +
      `box=1:boxcolor=${bg}:boxborderw=${Math.max(2, borderRadius/4)}:borderw=${outline}:` +
      `x=${x}:y=${y}${animExpr}:enable='between(t,${start},${end})'`;
    
    chains.push(`${current}${expr}${out}`);
    current = out;
  }

  // 4) ФИГУРЫ ПОЛНОСТЬЮ УБРАНЫ - используем только VIDEO OVERLAYS
  // Комбинированный элемент круг+стрелка теперь через video файл overlay_arrow.mov
  // for (const ov of overlays.filter((o) => o.target === "circle-arrow")) {
  //   step++;
  //   const out = `[v${step}]`;
  //   const start = (ov as any).startSec ?? 0;
  //   const end = (ov as any).endSec ?? start + 3;
  //   const duration = end - start;
  //   const shape = (ov as any).shape || {};
  //   const animation = shape.animation || {};
  //
  //   // Параметры круга
  //   const circle = shape.circle || {};
  //   const radius = circle.radius || 80;
  //   const circleColor = parseColor(circle.color || "#FF0000");
  //   const circleThickness = circle.thickness || 6;
  //   const fillOpacity = circle.fillOpacity || 0.1;
  //
  //   // Параметры стрелки
  //   const arrow = shape.arrow || {};
  //   const arrowLength = arrow.length || 60;
  //   const arrowAngle = (arrow.angle || 45) * Math.PI / 180; // в радианы
  //   const arrowColor = parseColor(arrow.color || "#FF0000");
  //   const arrowThickness = arrow.thickness || 6;
  //   const arrowHeadSize = arrow.headSize || 20;
  //
  //   // Позиция
  //   const centerX = shape.x || Math.round(width / 2);
  //   const centerY = shape.y || Math.round(height / 2);
  //
  //   // Создаем комбинированное изображение
  //   const canvasSize = Math.max(radius * 3, arrowLength + arrowHeadSize * 2);
  //   const png = path.join(workDir, `circle_arrow_${step}.png`);
  //   
  //   // Рисуем круг
  //     await Shapes.drawCirclePNG(png, radius, circleThickness, circleColor, fillOpacity);
  //   
  //   // Рисуем стрелку поверх (в отдельном файле, потом объединим)
  //   const arrowPng = path.join(workDir, `arrow_only_${step}.png`);
  //   const arrowX1 = radius + 10;
  //   const arrowY1 = radius;
  //   const arrowX2 = arrowX1 + arrowLength * Math.cos(arrowAngle);
  //   const arrowY2 = arrowY1 + arrowLength * Math.sin(arrowAngle);
  //   
  //     await Shapes.drawArrowPNG(
  //     arrowPng,
  //     canvasSize,
  //     canvasSize,
  //     arrowX1,
  //     arrowY1,
  //     arrowX2,
  //     arrowY2,
  //     arrowThickness,
  //     arrowHeadSize,
  //     arrowColor
  //   );
  //
  //   extraInputs.push(png, arrowPng);
  //
  //   // Позиция на экране
  //   const x = centerX - radius;
  //   const y = centerY - radius;
  //   const circleIdx = extraInputs.length - 2;
  //   const arrowIdx = extraInputs.length - 1;
  //
  //   // Анимация
  //   let animationFilters = "";
  //   const pulse = animation.pulse || {};
  //   const wobble = animation.arrowWobble || {};
  //   const highlight = animation.highlight || {};
  //
  //   if (pulse.enabled && duration > 1) {
  //     const scale = pulse.scale || 0.15;
  //     const freq = pulse.frequency || 1.5;
  //     animationFilters += `scale=iw*(1+${scale}*sin(2*PI*t/${freq})):ih*(1+${scale}*sin(2*PI*t/${freq})),`;
  //   }
  //
  //   if (highlight.enabled && duration > 1) {
  //     const brightness = highlight.brightness || 0.3;
  //     const freq = highlight.frequency || 1;
  //     animationFilters += `eq=brightness=${brightness}*sin(2*PI*t/${freq}):enable='between(t,${start},${end})',`;
  //   }
  //
  //   // Удаляем последнюю запятую
  //   if (animationFilters.endsWith(',')) {
  //     animationFilters = animationFilters.slice(0, -1);
  //   }
  //
  //   // Наложение круга и стрелки с лёгким миганием стрелки
  //   const blinkRate = 0.6;
  //   chains.push(
  //     `${current}[SH${circleIdx}:v]overlay=${x}:${y}:enable='between(t,${start},${end})'[circle_${step}];` +
  //     `[SH${arrowIdx}:v]format=yuva420p,colorchannelmixer=aa=0.5+0.5*abs(sin(2*PI*t/${blinkRate}))[blink_${step}];` +
  //     `[circle_${step}][blink_${step}]overlay=${x}:${y}:enable='between(t,${start},${end})'${out}`
  //   );
  //   current = out;
  // }

  // 5) ОБЫЧНЫЕ ФИГУРЫ ОТКЛЮЧЕНЫ - теперь используем video overlays
  // for (const ov of overlays.filter((o) =>
  //   ["rect", "circle", "arrow"].includes(o.target as string)
  // )) {
  //   step++;
  //   const out = `[v${step}]`;
  //   const start = (ov as any).startSec ?? 0;
  //   const end = (ov as any).endSec ?? start + 3;
  //   const duration = end - start;
  //
  //   if (ov.target === "rect") {
  //     const sh: any = (ov as any).shape || {};
  //     const w = Math.max(2, sh.w ?? 300);
  //     const h = Math.max(2, sh.h ?? 120);
  //     const color = parseColor(sh.color || "#FF4D4F");
  //     const thickness = Math.max(0, sh.thickness ?? 6);
  //     const fillOpacity = Math.max(0, Math.min(1, sh.fillOpacity ?? 0.15));
  //
  //     const png = path.join(workDir, `shape_rect_${step}.png`);
  //     await Shapes.drawRectPNG(png, w, h, thickness, color, fillOpacity);
  //     extraInputs.push(png);
  //
  //     const x = (ov as any).position?.x ?? Math.round((width - w) / 2);
  //     const y = (ov as any).position?.y ?? Math.round(height * safe + 10);
  //     const idx = extraInputs.length - 1;
  //     chains.push(
  //       `${current}[SH${idx}:v]overlay=${x}:${y}:enable='between(t,${start},${end})'${out}`
  //     );
  //     current = out;
  //   }
  //
  //   if (ov.target === "circle") {
  //     const sh: any = (ov as any).shape || {};
  //     const radius = Math.max(5, sh.radius ?? 56);
  //     const color = parseColor(sh.color || "#4D9EFF");
  //     const thickness = Math.max(0, sh.thickness ?? 6);
  //     const fillOpacity = Math.max(0, Math.min(1, sh.fillOpacity ?? 0.0));
  //
  //     const png = path.join(workDir, `shape_circle_${step}.png`);
  //     await Shapes.drawCirclePNG(png, radius, thickness, color, fillOpacity);
  //     extraInputs.push(png);
  //
  //     // Анимация движения круга (пульсация размера)
  //     const cx = (ov as any).position?.x ?? Math.round(width / 2);
  //     const cy = (ov as any).position?.y ?? Math.round(height / 2);
  //     const baseX = cx - radius;
  //     const baseY = cy - radius;
  //     
  //     // Добавляем пульсацию через изменение размера
  //     const scaleAnim = duration > 1 ? `scale=iw*(1+0.2*sin(2*PI*t/${duration})):ih*(1+0.2*sin(2*PI*t/${duration}))` : "";
  //     const idx = extraInputs.length - 1;
  //     
  //     if (scaleAnim) {
  //       chains.push(
  //         `${current}[SH${idx}:v]${scaleAnim}[scaled_circle_${step}];[scaled_circle_${step}]overlay=${baseX}:${baseY}:enable='between(t,${start},${end})'${out}`
  //       );
  //     } else {
  //     chains.push(
  //         `${current}[SH${idx}:v]overlay=${baseX}:${baseY}:enable='between(t,${start},${end})'${out}`
  //     );
  //     }
  //     current = out;
  //   }
  //
  //   if (ov.target === "arrow") {
  //     const sh: any = (ov as any).shape!;
  //     const color = parseColor(sh.color || "#FFD400");
  //     const thickness = Math.max(1, sh.thickness ?? 6);
  //     const headSize = Math.max(6, sh.headSize ?? 18);
  //
  //     const minX = Math.min(sh.x1, sh.x2);
  //     const minY = Math.min(sh.y1, sh.y2);
  //     const w = Math.max(1, Math.abs(sh.x2 - sh.x1)) + headSize * 2;
  //     const h = Math.max(1, Math.abs(sh.y2 - sh.y1)) + headSize * 2;
  //
  //     const png = path.join(workDir, `shape_arrow_${step}.png`);
  //     await Shapes.drawArrowPNG(
  //       png,
  //       w,
  //       h,
  //       sh.x1 - minX + headSize,
  //       sh.y1 - minY + headSize,
  //       sh.x2 - minX + headSize,
  //       sh.y2 - minY + headSize,
  //       thickness,
  //       headSize,
  //       color
  //     );
  //     extraInputs.push(png);
  //
  //     // Анимация мигания стрелки
  //     const baseX = minX - headSize;
  //     const baseY = minY - headSize;
  //     const blinkRate = 0.5; // мигание каждые 0.5 сек
  //     const idx = extraInputs.length - 1;
  //     
  //     // Создаем эффект мигания через изменение прозрачности
  //     const blinkExpr = duration > 1 ? `format=yuva420p,colorchannelmixer=aa=${0.3 + 0.7}*abs(sin(2*PI*t/${blinkRate}))` : "";
  //     
  //     if (blinkExpr && duration > 1) {
  //       chains.push(
  //         `${current}[SH${idx}:v]${blinkExpr}[blink_arrow_${step}];[blink_arrow_${step}]overlay=${baseX}:${baseY}:enable='between(t,${start},${end})'${out}`
  //       );
  //     } else {
  //     chains.push(
  //         `${current}[SH${idx}:v]overlay=${baseX}:${baseY}:enable='between(t,${start},${end})'${out}`
  //     );
  //     }
  //     current = out;
  //   }
  // }

  // Эффекты уже применены в начале (строки 69-80)

  // финальный вид
  step++;
  const final = `[vout_${step}]`;
  chains.push(`${current}format=yuv420p${final}`);

  return { filter: chains.join(";"), finalLabel: final, extraInputs };
}

/**
 * Строит FFmpeg фильтр для эффекта
 */
function buildEffectFilter(effect: EffectItem, totalDuration: number): string | null {
  const startTime = effect.startSec;
  const endTime = effect.endSec || totalDuration;
  const timeCondition = `between(t,${startTime},${endTime})`;

  switch (effect.kind) {
    case "zoom":
      const { startScale, endScale, cx, cy } = effect.params;
      const width = 1920; // TODO: получить из контекста
      const height = 1080;
      const centerX = cx * width;
      const centerY = cy * height;
      
      return `scale=${width * endScale}:${height * endScale},crop=${width}:${height}:${centerX - width/2}:${centerY - height/2}:enable='${timeCondition}'`;

    case "vhs":
      const { noise = 20, chroma = 2, contrast = 1.05, saturation = 1.15 } = effect.params || {};
      return `noise=alls=${noise}:allf=t,eq=contrast=${contrast}:saturation=${saturation},hue=s=${chroma}:enable='${timeCondition}'`;

    case "vhs-advanced":
      const params = (effect as any).params || {};
      const baseNoise = (params as any).noise || 20;
      const baseChroma = (params as any).chroma || 2.2;
      
      // Базовые эффекты
      let filter = `noise=alls=${baseNoise}:allf=t,hue=s=${baseChroma}`;
      
      // Хроматические аберрации
      const chromatic = (params as any).chromatic || {};
      if ((chromatic as any).enabled !== false) {
        const strength = (chromatic as any).strength || 3;
        const redShift = (chromatic as any).redShift || 1;
        const blueShift = (chromatic as any).blueShift || -1;
        
        // Упрощенная имитация хроматических аберраций
        filter += `,hue=h=${redShift}:s=${blueShift}`;
      }
      
      // Цветовая коррекция
      const color = (params as any).color || {};
      const colorContrast = (color as any).contrast || 1.2;
      const colorSaturation = (color as any).saturation || 1.3;
      const colorBrightness = (color as any).brightness || 1.0;
      
      filter += `,eq=contrast=${colorContrast}:saturation=${colorSaturation}:brightness=${colorBrightness}`;
      
      // Горизонтальные искажения (упрощенная версия)
      const distortion = (params as any).distortion || {};
      if ((distortion as any).enabled !== false) {
        const frequency = (distortion as any).frequency || 0.5;
        const amplitude = (distortion as any).amplitude || 2;
        filter += `,curves=all='0/0 0.5/${0.5 + amplitude*0.1} 1/1'`;
      }
      
      return `${filter}:enable='${timeCondition}'`;

    case "retro":
      const { vignette = Math.PI / 5, grain = 5, saturation: retroSaturation = 0.95, contrast: retroContrast = 1.05, gamma = 0.98 } = effect.params || {};
      return `vignette=PI/${vignette},noise=alls=${grain}:allf=t,eq=contrast=${retroContrast}:saturation=${retroSaturation}:gamma=${gamma}:enable='${timeCondition}'`;

    case "custom":
      return `${effect.filter}:enable='${timeCondition}'`;

    default:
      return null;
  }
}
