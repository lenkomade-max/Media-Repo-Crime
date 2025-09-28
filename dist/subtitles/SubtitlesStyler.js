import { parseColor, toASSColor } from "../utils/color.js";
/** Собирает force_style строку для ffmpeg subtitles */
export function buildForceStyle(style) {
    const s = style || {};
    const font = s.font || "DejaVu Sans";
    const size = s.size || 28;
    const color = toASSColor(parseColor(s.color || "#FFFFFF"));
    const outline = s.outline?.enabled !== false;
    const outlineW = s.outline?.width ?? 2;
    const outlineColor = toASSColor(parseColor(s.outline?.color || "#000000"));
    const bg = parseColor(s.background || "rgba(0,0,0,0.55)");
    const back = toASSColor(bg);
    // Alignment: 2 bottom-center, 8 top-center
    const align = (s.alignment || "bottom") === "top" ? 8 : 2;
    const marginV = s.marginV ?? 54;
    // BorderStyle=3 включает bg (BackColour)
    const parts = [
        `FontName=${font}`,
        `FontSize=${size}`,
        `PrimaryColour=${color}`,
        `Outline=${outline ? outlineW : 0}`,
        `OutlineColour=${outlineColor}`,
        `BorderStyle=3`,
        `BackColour=${back}`,
        `Alignment=${align}`,
        `MarginV=${marginV}`
    ];
    return parts.join(",");
}
