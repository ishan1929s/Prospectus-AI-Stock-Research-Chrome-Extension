const fs = require('fs');
const zlib = require('zlib');

// ASCII85 Decode implementation
function decodeAscii85(str) {
  // Clean ASCII85 string: strip whitespace and <~ ~> delimiters
  let clean = str.replace(/<~/g, '').replace(/~>/g, '').replace(/\s+/g, '');
  const out = [];
  let tuple = 0;
  let count = 0;

  for (let i = 0; i < clean.length; i++) {
    const c = clean.charCodeAt(i);
    if (clean[i] === 'z' && count === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    if (c >= 33 && c <= 117) {
      tuple = tuple * 85 + (c - 33);
      count++;
      if (count === 5) {
        out.push(
          (tuple >>> 24) & 0xff,
          (tuple >>> 16) & 0xff,
          (tuple >>> 8) & 0xff,
          tuple & 0xff
        );
        tuple = 0;
        count = 0;
      }
    }
  }

  if (count > 1) {
    for (let i = count; i < 5; i++) {
      tuple = tuple * 85 + 84;
    }
    for (let i = 0; i < count - 1; i++) {
      out.push((tuple >>> (24 - 8 * i)) & 0xff);
    }
  }

  return Buffer.from(out);
}

function extractAllTextFromPDF(pdfBuffer) {
  const binary = pdfBuffer.toString('latin1');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  let allText = [];

  while ((match = streamRegex.exec(binary)) !== null) {
    let raw = match[1];
    let streamBuf;

    // Check if ASCII85 encoded
    if (raw.includes('~>') || /^[!-u\s]+~>/.test(raw.trim())) {
      try {
        streamBuf = decodeAscii85(raw);
      } catch (e) {
        streamBuf = Buffer.from(raw, 'latin1');
      }
    } else {
      streamBuf = Buffer.from(raw, 'binary');
    }

    let decompressedStr = '';
    // Try Flate / Deflate decompressions
    try {
      decompressedStr = zlib.inflateSync(streamBuf).toString('latin1');
    } catch (e) {
      try {
        decompressedStr = zlib.inflateRawSync(streamBuf).toString('latin1');
      } catch (e2) {
        decompressedStr = streamBuf.toString('latin1');
      }
    }

    // Extract text from text blocks: BT ... ET
    const btRegex = /BT[\s\S]*?ET/g;
    const blocks = decompressedStr.match(btRegex) || [decompressedStr];

    for (const block of blocks) {
      // 1. (text) Tj
      const tjRegex = /\(([^)]*)\)\s*Tj/g;
      let tj;
      while ((tj = tjRegex.exec(block)) !== null) {
        const decoded = tj[1]
          .replace(/\\([0-7]{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
          .replace(/\\([\\()])/g, '$1');
        if (decoded.trim()) allText.push(decoded.trim());
      }

      // 2. [(t) -10 (ext)] TJ
      const tjArrRegex = /\[([\s\S]*?)\]\s*TJ/g;
      let tjArr;
      while ((tjArr = tjArrRegex.exec(block)) !== null) {
        const inner = tjArr[1];
        const innerStrings = inner.match(/\(([^)]*)\)/g) || [];
        let line = '';
        for (const s of innerStrings) {
          const clean = s.slice(1, -1)
            .replace(/\\([0-7]{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
            .replace(/\\([\\()])/g, '$1');
          line += clean;
        }
        if (line.trim()) allText.push(line.trim());
      }
    }
  }

  return allText.join(' ').replace(/\s+/g, ' ').trim();
}

const pdfPath = 'C:\\Users\\ishan\\Downloads\\Kairo_Dental_Clinic_Dummy_Knowledge_Base.pdf';
const buf = fs.readFileSync(pdfPath);
const res = extractAllTextFromPDF(buf);
console.log('--- EXTRACTED PDF TEXT LENGTH ---:', res.length);
console.log('--- FIRST 600 CHARACTERS ---\n', res.slice(0, 600));
