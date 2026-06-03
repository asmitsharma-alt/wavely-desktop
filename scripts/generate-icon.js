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

function roundedSquareAlpha(x, y, left, top, size, radius) {
  const cx = Math.max(left + radius, Math.min(left + size - radius, x));
  const cy = Math.max(top + radius, Math.min(top + size - radius, y));
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.sqrt(dx * dx + dy * dy);
  return 1 - smoothstep(radius - 1.2, radius + 1.2, d);
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

  const radius = size * 0.22;
  const blocks = [
    { x: 0.1875, y: 0.515625, c: [255, 77, 141] },
    { x: 0.296875, y: 0.40625, c: [255, 152, 88] },
    { x: 0.40625, y: 0.515625, c: [255, 209, 90] },
    { x: 0.515625, y: 0.40625, c: [105, 231, 255] },
    { x: 0.625, y: 0.515625, c: [167, 139, 250] },
    { x: 0.734375, y: 0.40625, c: [255, 77, 141] },
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / (size - 1);
      const ny = y / (size - 1);
      const baseAlpha = roundedRectAlpha(x + 0.5, y + 0.5, size, radius);
      let r = 16;
      let g = 16;
      let b = 24;

      const inner = roundedRectAlpha(x + 0.5, y + 0.5, size - 12, radius - 5);
      const shine = Math.max(0, 1 - Math.hypot(nx - 0.34, ny - 0.24) / 0.38) * inner;
      r += 8 * shine;
      g += 8 * shine;
      b += 10 * shine;

      const blockSize = size * 0.09375;
      const blockRadius = size * 0.0234375;
      for (const block of blocks) {
        const bx = size * block.x;
        const by = size * block.y;
        const alpha = roundedSquareAlpha(x + 0.5, y + 0.5, bx, by, blockSize, blockRadius);
        if (alpha > 0) {
          r = r * (1 - alpha) + block.c[0] * alpha;
          g = g * (1 - alpha) + block.c[1] * alpha;
          b = b * (1 - alpha) + block.c[2] * alpha;
        }
      }

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
