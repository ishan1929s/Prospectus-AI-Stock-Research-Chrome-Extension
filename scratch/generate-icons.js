const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Ensure icons directory exists
const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function createPng(width, height, drawFn) {
  // RGBA buffer
  const buffer = Buffer.alloc(width * height * 4);
  
  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = (y * width + x) * 4;
    buffer[idx] = r;
    buffer[idx + 1] = g;
    buffer[idx + 2] = b;
    buffer[idx + 3] = a;
  }
  
  drawFn(width, height, setPixel);
  
  // Format as PNG
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (1 + width * 4) + 1 + x * 4;
      rawData[dstIdx] = buffer[srcIdx];
      rawData[dstIdx + 1] = buffer[srcIdx + 1];
      rawData[dstIdx + 2] = buffer[srcIdx + 2];
      rawData[dstIdx + 3] = buffer[srcIdx + 3];
    }
  }
  
  const compressed = zlib.deflateSync(rawData);
  
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression method: Deflate
  ihdrData[11] = 0; // Filter method
  ihdrData[12] = 0; // Interlace: No
  const ihdrChunk = createChunk('IHDR', ihdrData);
  
  // IDAT chunk
  const idatChunk = createChunk('IDAT', compressed);
  
  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  
  // CRC
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeInt32BE(crc, 8 + len);
  return chunk;
}

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ -1;
}

function drawProspectusIcon(width, height, setPixel) {
  // Brand colors: Coral #cc785c (204, 120, 92), Canvas #faf9f5 (250, 249, 245), Ink #141413 (20, 20, 19)
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.46;
  const cornerRadius = width * 0.22;
  
  // Rounded squircle background in Coral #cc785c
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Rounded rect check
      const pad = width * 0.06;
      const rx = width - pad * 2;
      const ry = height - pad * 2;
      const cr = cornerRadius;
      
      const inX = x >= pad + cr && x <= pad + rx - cr;
      const inY = y >= pad + cr && y <= pad + ry - cr;
      let inside = inX || inY;
      
      if (!inside) {
        const cxTarget = x < cx ? pad + cr : pad + rx - cr;
        const cyTarget = y < cy ? pad + cr : pad + ry - cr;
        const dist = Math.hypot(x - cxTarget, y - cyTarget);
        inside = dist <= cr;
      }
      
      if (inside) {
        setPixel(x, y, 204, 120, 92, 255); // Warm coral
      }
    }
  }
  
  // Document page icon in Cream #faf9f5 with folded corner and lines
  const docL = Math.round(width * 0.26);
  const docR = Math.round(width * 0.74);
  const docT = Math.round(height * 0.22);
  const docB = Math.round(height * 0.78);
  const foldSize = Math.round(width * 0.16);
  
  for (let y = docT; y <= docB; y++) {
    for (let x = docL; x <= docR; x++) {
      // Top right folded corner check
      if (x > docR - foldSize && y < docT + foldSize && (x - (docR - foldSize)) + (docT + foldSize - y) > foldSize) {
        continue;
      }
      setPixel(x, y, 250, 249, 245, 255); // Cream canvas
    }
  }
  
  // Fold flap
  for (let y = docT; y <= docT + foldSize; y++) {
    for (let x = docR - foldSize; x <= docR; x++) {
      if ((x - (docR - foldSize)) + (y - docT) <= foldSize) {
        setPixel(x, y, 230, 223, 216, 255); // Hairline tint
      }
    }
  }
  
  // Document horizontal lines (ink/coral)
  if (width >= 32) {
    const lineL = docL + Math.round(width * 0.08);
    const lineR = docR - Math.round(width * 0.08);
    const lineH = Math.max(1, Math.round(height * 0.035));
    
    const y1 = docT + Math.round(height * 0.22);
    const y2 = docT + Math.round(height * 0.34);
    const y3 = docT + Math.round(height * 0.46);
    
    for (let lx = lineL; lx <= lineR; lx++) {
      for (let h = 0; h < lineH; h++) {
        setPixel(lx, y1 + h, 204, 120, 92, 220); // Coral accent line
        setPixel(lx, y2 + h, 61, 61, 58, 200);   // Ink line
        if (lx <= lineL + (lineR - lineL) * 0.65) {
          setPixel(lx, y3 + h, 61, 61, 58, 200); // Shorter ink line
        }
      }
    }
  }
}

[16, 48, 128].forEach(size => {
  const png = createPng(size, size, drawProspectusIcon);
  const outPath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Generated: ${outPath} (${size}x${size}, ${png.length} bytes)`);
});
