// film.mjs — assemble burst frames into gameplay.gif + contact sheet.
// Usage: node film.mjs <prefix> <count>   (reads shots/<prefix>_NN.png)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { GIFEncoder, quantize, applyPalette } from "gifenc";

const dir = path.dirname(fileURLToPath(import.meta.url));
const shots = path.join(dir, "shots");
const [prefix, countStr] = process.argv.slice(2);
const count = parseInt(countStr, 10);

const frames = [];
for (let i = 0; i < count; i++) {
  const p = path.join(shots, `${prefix}_${String(i).padStart(2, "0")}.png`);
  if (!fs.existsSync(p)) { console.log("missing:", p); process.exit(1); }
  frames.push(PNG.sync.read(fs.readFileSync(p)));
}
const SW = 640, SH = 400;
const small = frames.map((f) => {
  const out = { width: SW, height: SH, data: Buffer.alloc(SW * SH * 4) };
  const sx = f.width / SW, sy = f.height / SH;
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      const si = ((Math.floor(y * sy) * f.width) + Math.floor(x * sx)) * 4;
      const di = (y * SW + x) * 4;
      out.data[di] = f.data[si]; out.data[di + 1] = f.data[si + 1];
      out.data[di + 2] = f.data[si + 2]; out.data[di + 3] = 255;
    }
  }
  return out;
});

// Animated GIF (all frames share one palette for size).
const all = Buffer.concat(small.map((f) => f.data));
const palette = quantize(all, 256);
const gif = GIFEncoder();
for (const f of small) {
  const idx = applyPalette(f.data, palette);
  gif.writeFrame(idx, SW, SH, { palette, delay: 350 });
}
gif.finish();
fs.writeFileSync(path.join(shots, `${prefix}.gif`), Buffer.from(gif.bytes()));
console.log("gif:", `${prefix}.gif`, (gif.bytes().length / 1024).toFixed(0) + "KB");

// Contact sheet 3×2 (always readable fallback).
const cols = 3, rows = 2, cw = 426, ch = 266;
const sheet = new PNG({ width: cols * cw, height: rows * ch });
const use = small.slice(0, 6);
use.forEach((f, k) => {
  const ox = (k % cols) * cw, oy = Math.floor(k / cols) * ch;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((Math.floor(y * (SH / ch)) * SW) + Math.floor(x * (SW / cw))) * 4;
      const di = (((oy + y) * sheet.width) + (ox + x)) * 4;
      sheet.data[di] = f.data[si]; sheet.data[di + 1] = f.data[si + 1];
      sheet.data[di + 2] = f.data[si + 2]; sheet.data[di + 3] = 255;
    }
  }
});
fs.writeFileSync(path.join(shots, `${prefix}_sheet.png`), PNG.sync.write(sheet));
console.log("sheet:", `${prefix}_sheet.png`);
