const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(outDir, { recursive: true });

function clamp(v, min = 0, max = 255) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function roundedRectAlpha(x, y, size, radius) {
  const cx = Math.max(radius, Math.min(size - radius, x));
  const cy = Math.max(radius, Math.min(size - radius, y));
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.sqrt(dx * dx + dy * dy);
  return 1 - smoothstep(radius - 1.5, radius + 1.5, d);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const c1 = vx * wx + vy * wy;
  const c2 = vx * vx + vy * vy;
  const t = c2 ? Math.max(0, Math.min(1, c1 / c2)) : 0;
  const x = ax + t * vx;
  const y = ay + t * vy;
  const dx = px - x;
  const dy = py - y;
  return Math.sqrt(dx * dx + dy * dy);
}

function wavePoints(size) {
  const pts = [];
  const margin = size * 0.18;
  const amp = size * 0.105;
  const mid = size * 0.51;
  const width = size - margin * 2;
  for (let i = 0; i <= 180; i++) {
    const t = i / 180;
    const x = margin + width * t;
    const y = mid + Math.sin(t * Math.PI * 4 - Math.PI * 0.15) * amp;
    pts.push([x, y]);
  }
  return pts;
}

function makeImage(size) {
  const headerSize = 40;
  const xorSize = size * size * 4;
  const andStride = Math.ceil(size / 32) * 4;
  const andSize = andStride * size;
  const dib = Buffer.alloc(headerSize + xorSize + andSize);

  dib.writeUInt32LE(headerSize, 0);
  dib.writeInt32LE(size, 4);
  dib.writeInt32LE(size * 2, 8);
  dib.writeUInt16LE(1, 12);
  dib.writeUInt16LE(32, 14);
  dib.writeUInt32LE(0, 16);
  dib.writeUInt32LE(xorSize + andSize, 20);

  const pts = wavePoints(size);
  const stroke = Math.max(5, size * 0.075);
  const radius = size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / (size - 1);
      const ny = y / (size - 1);
      const baseAlpha = roundedRectAlpha(x + 0.5, y + 0.5, size, radius);
      let r = 247;
      let g = 242;
      let b = 251;

      const inner = roundedRectAlpha(x + 0.5, y + 0.5, size - 12, radius - 5);
      const shine = Math.max(0, 1 - Math.hypot(nx - 0.34, ny - 0.24) / 0.38) * inner;
      r += 8 * shine;
      g += 8 * shine;
      b += 8 * shine;

      let dist = Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const c = pts[i + 1];
        dist = Math.min(dist, distToSegment(x + 0.5, y + 0.5, a[0], a[1], c[0], c[1]));
      }
      const wave = 1 - smoothstep(stroke * 0.48, stroke * 0.62, dist);
      const halo = 1 - smoothstep(stroke * 1.0, stroke * 2.0, dist);

      r = r * (1 - halo * 0.18) + 23 * halo * 0.18;
      g = g * (1 - halo * 0.18) + 16 * halo * 0.18;
      b = b * (1 - halo * 0.18) + 32 * halo * 0.18;

      r = r * (1 - wave) + 23 * wave;
      g = g * (1 - wave) + 16 * wave;
      b = b * (1 - wave) + 32 * wave;

      const off = headerSize + ((size - 1 - y) * size + x) * 4;
      dib[off] = clamp(b);
      dib[off + 1] = clamp(g);
      dib[off + 2] = clamp(r);
      dib[off + 3] = clamp(baseAlpha * 255);
    }
  }

  return dib;
}

function makeIco(sizes) {
  const images = sizes.map(size => ({ size, dib: makeImage(size) }));
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = header.length;
  images.forEach((img, index) => {
    const pos = 6 + index * 16;
    header[pos] = img.size === 256 ? 0 : img.size;
    header[pos + 1] = img.size === 256 ? 0 : img.size;
    header[pos + 2] = 0;
    header[pos + 3] = 0;
    header.writeUInt16LE(1, pos + 4);
    header.writeUInt16LE(32, pos + 6);
    header.writeUInt32LE(img.dib.length, pos + 8);
    header.writeUInt32LE(offset, pos + 12);
    offset += img.dib.length;
  });

  return Buffer.concat([header, ...images.map(img => img.dib)]);
}

fs.writeFileSync(path.join(outDir, 'icon.ico'), makeIco([16, 32, 48, 64, 128, 256]));
console.log('Generated build/icon.ico');
