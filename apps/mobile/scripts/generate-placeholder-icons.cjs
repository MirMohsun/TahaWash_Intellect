#!/usr/bin/env node
/**
 * Generate solid-color placeholder PNGs for Expo's icon/splash/favicon
 * slots. Zero-deps: uses Node's built-in zlib + manual PNG chunk emission.
 *
 * These are MVP placeholders. Replace with properly designed brand icons
 * in Phase 6 (lawyer + store-prep stage) — designers should output the
 * full size set: 1024x1024 master icon, foreground-only adaptive variant
 * with a 33% safe zone, multi-density splash/launch images, etc.
 *
 * Run: node apps/mobile/scripts/generate-placeholder-icons.cjs
 * (Idempotent — overwrites existing PNGs.)
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

// CRC table for PNG chunk CRC32 (PNG uses standard IEEE 802.3 CRC32).
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

/**
 * Build a solid-color RGB PNG of given size.
 * @param {number} width
 * @param {number} height
 * @param {[number, number, number]} rgb — 0..255 each
 */
function solidPng(width, height, rgb) {
  // PNG signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw image data: 1 filter byte (0 = None) + 3 bytes per pixel, per row.
  const rowBytes = 1 + width * 3;
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const off = y * rowBytes;
    raw[off] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      const p = off + 1 + x * 3;
      raw[p] = rgb[0];
      raw[p + 1] = rgb[1];
      raw[p + 2] = rgb[2];
    }
  }
  const idatData = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BRAND_BLUE = [0x0e, 0x7a, 0xe7]; // #0E7AE7
const BRAND_TINT = [0xfa, 0xfe, 0xff]; // #FAFEFF (splash background)

const outputs = [
  { file: 'icon.png', width: 1024, height: 1024, color: BRAND_BLUE },
  { file: 'adaptive-icon.png', width: 1024, height: 1024, color: BRAND_BLUE },
  { file: 'splash.png', width: 1284, height: 2778, color: BRAND_TINT },
  { file: 'favicon.png', width: 48, height: 48, color: BRAND_BLUE },
];

const outDir = path.resolve(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });

for (const { file, width, height, color } of outputs) {
  const buf = solidPng(width, height, color);
  const dest = path.join(outDir, file);
  fs.writeFileSync(dest, buf);
  console.log(`  ✓ ${file} (${width}×${height}, ${buf.length.toLocaleString()} bytes)`);
}

console.log('\nDone. PNGs are MVP placeholders — replace with branded icons in Phase 6.');
