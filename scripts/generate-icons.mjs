import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const TEAL = [14, 107, 99];
const PAPER = [244, 241, 234];
const DOT = [224, 122, 61];
const SPLASH = [239, 236, 230];

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const start = y * (width * 4 + 1);
    raw[start] = 0;
    rgba.copy(raw, start + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}

function fill(buf, width, height, color) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = 255;
    }
  }
}

function blend(buf, width, height, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= width || y >= height || alpha <= 0) return;
  const i = (y * width + x) * 4;
  const src = Math.max(0, Math.min(1, alpha));
  buf[i] = Math.round(color[0] * src + buf[i] * (1 - src));
  buf[i + 1] = Math.round(color[1] * src + buf[i + 1] * (1 - src));
  buf[i + 2] = Math.round(color[2] * src + buf[i + 2] * (1 - src));
  buf[i + 3] = 255;
}

function roundedRect(buf, width, height, x, y, w, h, radius, color) {
  const r = Math.min(radius, w / 2, h / 2);
  for (let py = Math.floor(y); py < Math.ceil(y + h); py += 1) {
    for (let px = Math.floor(x); px < Math.ceil(x + w); px += 1) {
      const dx = px + 0.5;
      const dy = py + 0.5;
      let cx = dx;
      let cy = dy;
      if (dx < x + r) cx = x + r;
      else if (dx > x + w - r) cx = x + w - r;
      if (dy < y + r) cy = y + r;
      else if (dy > y + h - r) cy = y + h - r;
      const dist = Math.hypot(dx - cx, dy - cy);
      const coverage = Math.max(0, Math.min(1, r - dist + 0.6));
      if (dx >= x + r && dx <= x + w - r && dy >= y && dy <= y + h) {
        blend(buf, width, height, px, py, color, 1);
      } else if (dy >= y + r && dy <= y + h - r && dx >= x && dx <= x + w) {
        blend(buf, width, height, px, py, color, 1);
      } else {
        blend(buf, width, height, px, py, color, coverage);
      }
    }
  }
}

function fillRect(buf, width, height, x, y, w, h, color) {
  roundedRect(buf, width, height, x, y, w, h, Math.min(w, h) / 2, color);
}

function circle(buf, width, height, cx, cy, radius, color) {
  const minX = Math.floor(cx - radius - 1);
  const maxX = Math.ceil(cx + radius + 1);
  const minY = Math.floor(cy - radius - 1);
  const maxY = Math.ceil(cy + radius + 1);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      blend(buf, width, height, x, y, color, Math.max(0, Math.min(1, radius - dist + 0.6)));
    }
  }
}

function drawMark(buf, size, pad) {
  const inner = size - pad * 2;
  const x = pad + inner * 0.18;
  const y = pad + inner * 0.2;
  const w = inner * 0.64;
  const h = inner * 0.58;
  roundedRect(buf, size, size, x, y, w, h, inner * 0.1, PAPER);
  const line = (ly, lw) => {
    fillRect(buf, size, size, x + w * 0.16, ly, w * lw, Math.max(2, inner * 0.045), TEAL);
  };
  line(y + h * 0.32, 0.46);
  line(y + h * 0.5, 0.62);
  line(y + h * 0.68, 0.36);
  circle(buf, size, size, x + w * 0.82, y + h * 0.16, inner * 0.055, DOT);
}

function icon(size, padRatio) {
  const buf = Buffer.alloc(size * size * 4);
  fill(buf, size, size, TEAL);
  drawMark(buf, size, size * padRatio);
  return encodePng(size, size, buf);
}

function splash(width, height) {
  const buf = Buffer.alloc(width * height * 4);
  fill(buf, width, height, SPLASH);
  const mark = Math.round(Math.min(width, height) * 0.22);
  const tile = Buffer.alloc(mark * mark * 4);
  fill(tile, mark, mark, TEAL);
  drawMark(tile, mark, mark * 0.08);
  const ox = Math.round((width - mark) / 2);
  const oy = Math.round((height - mark) / 2 - height * 0.04);
  for (let y = 0; y < mark; y += 1) {
    for (let x = 0; x < mark; x += 1) {
      const src = (y * mark + x) * 4;
      const destX = ox + x;
      const destY = oy + y;
      if (destX < 0 || destY < 0 || destX >= width || destY >= height) continue;
      const dest = (destY * width + destX) * 4;
      buf[dest] = tile[src];
      buf[dest + 1] = tile[src + 1];
      buf[dest + 2] = tile[src + 2];
      buf[dest + 3] = 255;
    }
  }
  const radius = Math.round(mark * 0.18);
  roundedMask(buf, width, height, ox, oy, mark, mark, radius);
  return encodePng(width, height, buf);
}

function roundedMask(buf, width, height, x, y, w, h, radius) {
  const r = radius;
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) {
      const dx = px + 0.5;
      const dy = py + 0.5;
      let cx = dx;
      let cy = dy;
      if (dx < x + r) cx = x + r;
      else if (dx > x + w - r) cx = x + w - r;
      if (dy < y + r) cy = y + r;
      else if (dy > y + h - r) cy = y + h - r;
      const insideCore =
        (dx >= x + r && dx <= x + w - r) || (dy >= y + r && dy <= y + h - r);
      const dist = Math.hypot(dx - cx, dy - cy);
      if (!insideCore && dist > r) {
        const i = (py * width + px) * 4;
        buf[i] = SPLASH[0];
        buf[i + 1] = SPLASH[1];
        buf[i + 2] = SPLASH[2];
      }
    }
  }
}

function write(path, png) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, png);
}

const root = resolve(import.meta.dirname, '..');
const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];
for (const size of sizes) {
  write(resolve(root, `public/icons/icon-${size}.png`), icon(size, 0));
}
write(resolve(root, 'public/icons/icon-maskable-192.png'), icon(192, 0.16));
write(resolve(root, 'public/icons/icon-maskable-512.png'), icon(512, 0.16));
write(resolve(root, 'public/splash/splash-1170x2532.png'), splash(1170, 2532));
write(resolve(root, 'public/splash/splash-1284x2778.png'), splash(1284, 2778));
console.log('ícones gerados');
