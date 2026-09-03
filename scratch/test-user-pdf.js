const fs = require('fs');
const zlib = require('zlib');

function extractTextFromPDFBuffer(buffer) {
  const binary = buffer.toString('binary');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  let textParts = [];

  while ((match = streamRegex.exec(binary)) !== null) {
    const rawStream = Buffer.from(match[1], 'binary');
    let streamText = '';

    try {
      streamText = zlib.inflateSync(rawStream).toString('latin1');
    } catch (e) {
      try {
        streamText = zlib.inflateRawSync(rawStream).toString('latin1');
      } catch (e2) {
        streamText = rawStream.toString('latin1');
      }
    }

    // Extract text from text blocks: BT ... ET
    const btRegex = /BT[\s\S]*?ET/g;
    const blocks = streamText.match(btRegex) || [streamText];

    for (const block of blocks) {
      // 1. (text) Tj
      const tjRegex = /\(([^)]*)\)\s*Tj/g;
      let tj;
      while ((tj = tjRegex.exec(block)) !== null) {
        const decoded = tj[1]
          .replace(/\\([0-7]{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
          .replace(/\\([\\()])/g, '$1');
        if (decoded.trim()) textParts.push(decoded.trim());
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
        if (line.trim()) textParts.push(line.trim());
      }

      // 3. Hex strings <48656c6c6f> Tj
      const hexRegex = /<([0-9a-fA-F\s]+)>\s*Tj/g;
      let hexMatch;
      while ((hexMatch = hexRegex.exec(block)) !== null) {
        const hex = hexMatch[1].replace(/\s+/g, '');
        let decoded = '';
        for (let i = 0; i < hex.length; i += 2) {
          decoded += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        }
        if (decoded.trim()) textParts.push(decoded.trim());
      }
    }
  }

  return textParts.join(' ').replace(/\s+/g, ' ').trim();
}

const pdfPath = 'C:\\Users\\ishan\\Downloads\\Kairo_Dental_Clinic_Dummy_Knowledge_Base.pdf';
const buf = fs.readFileSync(pdfPath);
const extracted = extractTextFromPDFBuffer(buf);
console.log('Extracted Text Length:', extracted.length);
console.log('Sample Extracted Text:\n', extracted.slice(0, 500));
