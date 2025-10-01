/** Парсит "#RRGGBB" или "rgba(r,g,b,a)" в RGBA (0..255, alpha 0..1) */
export function parseColor(input: string, fallback = {r:255,g:255,b:255,a:1}) {
  if (!input) return fallback;
  const s = input.trim();
  const hex = s.match(/^#?([0-9a-f]{6})$/i);
  if (hex) {
    const v = hex[1];
    const r = parseInt(v.slice(0,2),16);
    const g = parseInt(v.slice(2,4),16);
    const b = parseInt(v.slice(4,6),16);
    return { r,g,b,a:1 };
  }
  const rgba = s.match(/^rgba?\s*\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})(?:\s*,\s*([0-9]*\.?[0-9]+))?\s*\)$/i);
  if (rgba) {
    const r = Math.min(255, parseInt(rgba[1],10));
    const g = Math.min(255, parseInt(rgba[2],10));
    const b = Math.min(255, parseInt(rgba[3],10));
    const a = Math.max(0, Math.min(1, rgba[4] ? parseFloat(rgba[4]) : 1));
    return { r,g,b,a };
  }
  return fallback;
}

/** ffmpeg drawtext/drawbox color: 0xRRGGBB@A */
export function toFFColor(c: {r:number,g:number,b:number,a:number}) {
  const hex = (n:number)=> n.toString(16).padStart(2,"0").toUpperCase();
  return `0x${hex(c.r)}${hex(c.g)}${hex(c.b)}@${(c.a).toFixed(3)}`;
}

/** ASS &HAA BB GG RR& (alpha 0..255 inverted: 0=opaque, 255=transparent) */
export function toASSColor(c: {r:number,g:number,b:number,a:number}) {
  const hex = (n:number)=> n.toString(16).padStart(2,"0").toUpperCase();
  const A = 255 - Math.round(c.a*255);
  return `&H${hex(A)}${hex(c.b)}${hex(c.g)}${hex(c.r)}&`;
}
