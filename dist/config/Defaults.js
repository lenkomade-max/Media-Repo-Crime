import fs from "fs/promises";
import path from "path";
const FALLBACK = JSON.parse(`{
  "version":"1",
  "canvas":{"width":1080,"height":1920,"fps":30,"safeAreaPct":0.05},
  "subtitles":{"font":"DejaVu Sans","size":28,"color":"#FFFFFF","background":"rgba(0,0,0,0.55)",
    "outline":{"enabled":true,"width":2,"color":"#000000"},"alignment":"bottom","marginV":54},
  "overlayTop":{"font":"DejaVu Sans","size":44,"color":"#FFD400","background":"rgba(0,0,0,0.35)",
    "outlineWidth":2,"anchor":"top","defaultDurationSec":5},
  "overlayBottom":{"font":"DejaVu Sans","size":36,"color":"#FFFFFF","background":"rgba(0,0,0,0.55)",
    "outlineWidth":2,"anchor":"bottom","defaultDurationSec":5},
  "shapes":{"rect":{"color":"#FF4D4F","thickness":6,"fillOpacity":0.0},
    "circle":{"color":"#4D9EFF","thickness":6,"fillOpacity":0.0,"radius":56},
    "arrow":{"color":"#FFD400","thickness":6,"headSize":18}},
  "paths":{"fontFile":"/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"}
}`);
export async function loadDefaults(projectRoot = process.cwd()) {
    const p1 = path.join(projectRoot, "src", "config", "defaults.json");
    const p2 = path.join(projectRoot, "config", "defaults.json");
    for (const p of [p1, p2]) {
        try {
            const raw = await fs.readFile(p, "utf8");
            return JSON.parse(raw);
        }
        catch { }
    }
    return FALLBACK;
}
