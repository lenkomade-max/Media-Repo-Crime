import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import * as PImage from "pureimage";
async function savePNG(img, outPath) {
    await fsp.mkdir(path.dirname(outPath), { recursive: true });
    await new Promise((resolve, reject) => {
        const stream = fs.createWriteStream(outPath);
        PImage.encodePNGToStream(img, stream)
            .then(() => resolve())
            .catch(reject);
    });
}
export async function drawRectPNG(outPath, w, h, stroke, color, fillOpacity) {
    const img = PImage.make(w, h);
    const ctx = img.getContext("2d");
    // Fill
    if (fillOpacity > 0) {
        ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${fillOpacity})`;
        ctx.fillRect(0, 0, w, h);
    }
    // Stroke
    if (stroke > 0) {
        ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},1)`;
        ctx.lineWidth = stroke;
        ctx.strokeRect(stroke / 2, stroke / 2, w - stroke, h - stroke);
    }
    await savePNG(img, outPath);
}
export async function drawCirclePNG(outPath, radius, stroke, color, fillOpacity) {
    const d = Math.max(4, radius * 2);
    const img = PImage.make(d, d);
    const ctx = img.getContext("2d");
    // Fill
    if (fillOpacity > 0) {
        ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${fillOpacity})`;
        ctx.beginPath();
        ctx.arc(radius, radius, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
    }
    // Stroke
    if (stroke > 0) {
        ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},1)`;
        ctx.lineWidth = stroke;
        ctx.beginPath();
        ctx.arc(radius, radius, radius - stroke / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.stroke();
    }
    await savePNG(img, outPath);
}
export async function drawArrowPNG(outPath, w, h, x1, y1, x2, y2, thickness, headSize, color) {
    // Нормализуем в локальные координаты (минимальная рамка)
    const minX = Math.min(x1, x2), minY = Math.min(y1, y2);
    const ax = x1 - minX, ay = y1 - minY;
    const bx = x2 - minX, by = y2 - minY;
    const img = PImage.make(w, h);
    const ctx = img.getContext("2d");
    ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},1)`;
    ctx.lineWidth = thickness;
    // Основная линия
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    // Стрелочный наконечник
    const dx = bx - ax, dy = by - ay;
    const len = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / len, uy = dy / len;
    const hs = headSize;
    // два крыла под ~25°
    const angle = 25 * Math.PI / 180;
    const sin = Math.sin(angle), cos = Math.cos(angle);
    // Вектор назад
    const rx = -ux, ry = -uy;
    function rot(vx, vy, s, c) {
        return { x: vx * c - vy * s, y: vx * s + vy * c };
    }
    const r1 = rot(rx, ry, sin, cos), r2 = rot(rx, ry, -sin, cos);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + r1.x * hs, by + r1.y * hs);
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + r2.x * hs, by + r2.y * hs);
    ctx.stroke();
    await savePNG(img, outPath);
}
