const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Ensure icons directory exists
const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function createPng(width, height, getPixelRgba) {
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixelRgba(x, y);
      const dst = y * (1 + width * 4) + 1 + x * 4;
      rawData[dst] = r;
      rawData[dst + 1] = g;
      rawData[dst + 2] = b;
      rawData[dst + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  function createChunk(type, data) {
    const len = data.length;
    const chunk = Buffer.alloc(8 + len + 4);
    chunk.writeUInt32BE(len, 0);
    chunk.write(type, 4, 4, 'ascii');
    data.copy(chunk, 8);
    const crc = crc32(chunk.subarray(4, 8 + len));
    chunk.writeInt32BE(crc, 8 + len);
    return chunk;
  }

  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : (c >>> 1);
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

  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', compressed),
    createChunk('IEND', Buffer.alloc(0))
  ]);
}

function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay;
  const bax = bx - ax, bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * h, pay - bay * h);
}

function sdRoundedBox(px, py, w, h, r) {
  const qx = Math.abs(px) - (w / 2 - r);
  const qy = Math.abs(py) - (h / 2 - r);
  return Math.hypot(Math.max(0, qx), Math.max(0, qy)) + Math.min(0, Math.max(qx, qy)) - r;
}

function sdArc(px, py, cx, cy, r, a0, a1) {
  const angle = Math.atan2(py - cy, px - cx);
  let normAngle = angle;
  while (normAngle < a0) normAngle += Math.PI * 2;
  while (normAngle > a0 + Math.PI * 2) normAngle -= Math.PI * 2;

  if (normAngle >= a0 && normAngle <= a1) {
    return Math.abs(Math.hypot(px - cx, py - cy) - r);
  }
  const d0 = Math.hypot(px - (cx + r * Math.cos(a0)), py - (cy + r * Math.sin(a0)));
  const d1 = Math.hypot(px - (cx + r * Math.cos(a1)), py - (cy + r * Math.sin(a1)));
  return Math.min(d0, d1);
}

function renderProspectusLogo(size) {
  const ss = 4;
  const W = size * ss;
  const H = size * ss;
  const cx = W / 2;
  const cy = H / 2;

  const badgePad = size <= 16 ? 0.2 * ss : (size <= 32 ? 0.6 * ss : 2.5 * ss);
  const badgeSize = W - badgePad * 2;
  const badgeRadius = badgeSize * 0.25;
  const borderWidth = size <= 16 ? 0.8 * ss : (size <= 32 ? 1.2 * ss : Math.max(1.8 * ss, W * 0.035));

  let straightSegments = [];
  let arcs = [];
  let strokeRadius = 0;

  if (size <= 16) {
    // Tuned pixel coordinates for 16x16
    const s16 = ss;
    strokeRadius = 0.55 * s16;

    straightSegments = [
      [4.5 * s16, 2.5 * s16, 9.5 * s16, 2.5 * s16],
      [9.5 * s16, 2.5 * s16, 12.5 * s16, 5.5 * s16],
      [12.5 * s16, 5.5 * s16, 12.5 * s16, 12.5 * s16],
      [11.5 * s16, 13.5 * s16, 4.5 * s16, 13.5 * s16],
      [3.5 * s16, 12.5 * s16, 3.5 * s16, 3.5 * s16],

      [9.5 * s16, 2.5 * s16, 9.5 * s16, 5.5 * s16],
      [9.5 * s16, 5.5 * s16, 12.5 * s16, 5.5 * s16],

      [5.5 * s16, 9.0 * s16, 10.5 * s16, 9.0 * s16],
      [5.5 * s16, 11.5 * s16, 9.5 * s16, 11.5 * s16],
    ];

    arcs = [
      [4.5 * s16, 3.5 * s16, 1.0 * s16, Math.PI, 1.5 * Math.PI],
      [4.5 * s16, 12.5 * s16, 1.0 * s16, 0.5 * Math.PI, Math.PI],
      [11.5 * s16, 12.5 * s16, 1.0 * s16, 0, 0.5 * Math.PI],
    ];
  } else {
    // High-resolution SVG scale for 32, 48, 128
    const docScale = (badgeSize * 0.65) / 24;
    const docOx = cx - 12 * docScale;
    const docOy = cy - 12 * docScale;

    function toX(vx) { return docOx + vx * docScale; }
    function toY(vy) { return docOy + vy * docScale; }

    const strokeWidth = size <= 32 ? 2.4 : 2.2;
    strokeRadius = (strokeWidth * docScale) / 2;

    straightSegments = [
      [toX(6), toY(2), toX(14), toY(2)],
      [toX(14), toY(2), toX(20), toY(8)],
      [toX(20), toY(8), toX(20), toY(20)],
      [toX(18), toY(22), toX(6), toY(22)],
      [toX(4), toY(20), toX(4), toY(4)],

      [toX(14), toY(2), toX(14), toY(8)],
      [toX(14), toY(8), toX(20), toY(8)],

      [toX(8), toY(9), toX(10), toY(9)],
      [toX(8), toY(13), toX(16), toY(13)],
      [toX(8), toY(17), toX(16), toY(17)],
    ];

    arcs = [
      [toX(6), toY(4), 2 * docScale, Math.PI, 1.5 * Math.PI],
      [toX(6), toY(20), 2 * docScale, 0.5 * Math.PI, Math.PI],
      [toX(18), toY(20), 2 * docScale, 0, 0.5 * Math.PI],
    ];
  }

  return createPng(size, size, (outX, outY) => {
    let rAcc = 0, gAcc = 0, bAcc = 0, aAcc = 0;

    for (let sy = 0; sy < ss; sy++) {
      for (let sx = 0; sx < ss; sx++) {
        const px = outX * ss + sx + 0.5;
        const py = outY * ss + sy + 0.5;

        const dBadge = sdRoundedBox(px - cx, py - cy, badgeSize, badgeSize, badgeRadius);

        const dShadow = sdRoundedBox(px - cx, py - (cy + ss * 0.7), badgeSize, badgeSize, badgeRadius);
        let sAlpha = Math.max(0, Math.min(1, (1.8 * ss - dShadow) / (2.2 * ss))) * 0.16;

        if (dBadge > 1.5 * ss && sAlpha <= 0) {
          continue;
        }

        let sr = 0, sg = 0, sb = 0, sa = 0;
        if (sAlpha > 0 && dBadge > 0) {
          sr = 20; sg = 20; sb = 19; sa = sAlpha;
        }

        const badgeCov = Math.max(0, Math.min(1, 0.5 - dBadge));
        if (badgeCov > 0) {
          const borderFactor = Math.max(0, Math.min(1, (dBadge + borderWidth) / borderWidth));
          
          const bgR = 243 * (1 - borderFactor * 0.45) + 224 * (borderFactor * 0.45);
          const bgG = 236 * (1 - borderFactor * 0.45) + 213 * (borderFactor * 0.45);
          const bgB = 225 * (1 - borderFactor * 0.45) + 197 * (borderFactor * 0.45);

          let curR = bgR;
          let curG = bgG;
          let curB = bgB;
          let curA = 1.0;

          let minDocDist = 999999;
          for (const [ax, ay, bx, by] of straightSegments) {
            const d = sdSegment(px, py, ax, ay, bx, by);
            if (d < minDocDist) minDocDist = d;
          }
          for (const [acx, acy, ar, a0, a1] of arcs) {
            const d = sdArc(px, py, acx, acy, ar, a0, a1);
            if (d < minDocDist) minDocDist = d;
          }

          const docDist = minDocDist - strokeRadius;
          const docCov = Math.max(0, Math.min(1, 0.5 - docDist));

          if (docCov > 0) {
            // Terracotta #cc785c (204, 120, 92)
            const cR = 204, cG = 120, cB = 92;
            curR = curR * (1 - docCov) + cR * docCov;
            curG = curG * (1 - docCov) + cG * docCov;
            curB = curB * (1 - docCov) + cB * docCov;
          }

          sr = sr * (1 - badgeCov) + curR * badgeCov;
          sg = sg * (1 - badgeCov) + curG * badgeCov;
          sb = sb * (1 - badgeCov) + curB * badgeCov;
          sa = sa * (1 - badgeCov) + curA * badgeCov;
        }

        rAcc += sr * sa;
        gAcc += sg * sa;
        bAcc += sb * sa;
        aAcc += sa;
      }
    }

    const totalSamples = ss * ss;
    const finalA = aAcc / totalSamples;
    if (finalA <= 0.001) return [0, 0, 0, 0];
    return [
      Math.round(rAcc / aAcc),
      Math.round(gAcc / aAcc),
      Math.round(bAcc / aAcc),
      Math.round(finalA * 255)
    ];
  });
}

const sizes = [16, 32, 48, 128];
sizes.forEach(size => {
  const png = renderProspectusLogo(size);
  const outPath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Generated: ${outPath} (${size}x${size}, ${png.length} bytes)`);
});
