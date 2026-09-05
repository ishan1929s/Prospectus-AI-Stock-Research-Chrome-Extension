/**
 * Prospectus - Pure JavaScript PDF Text Extractor
 * Decompresses and extracts readable text from PDF streams (FlateDecode, ASCII85Decode, uncompressed).
 * Runs seamlessly in Chrome extensions (Content scripts, Background Worker, Side Panel).
 */

class PDFExtractor {
  /**
   * Decode ASCII85 / Base85 data string to Uint8Array
   */
  static decodeAscii85(str) {
    let clean = str.replace(/<~/g, '').replace(/~>/g, '').replace(/\s+/g, '');
    const out = [];
    let tuple = 0;
    let count = 0;

    for (let i = 0; i < clean.length; i++) {
      if (clean[i] === 'z' && count === 0) {
        out.push(0, 0, 0, 0);
        continue;
      }
      const c = clean.charCodeAt(i);
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

    return new Uint8Array(out);
  }

  /**
   * Decompress Deflate / zlib stream using browser DecompressionStream or fallback
   */
  static async decompressDeflate(uint8Bytes) {
    // 1. Try standard DecompressionStream('deflate')
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('deflate');
        const writer = ds.writable.getWriter();
        writer.write(uint8Bytes);
        writer.close();
        const response = new Response(ds.readable);
        const arrayBuf = await response.arrayBuffer();
        const decoder = new TextDecoder('latin1');
        return decoder.decode(arrayBuf);
      } catch (e) {
        try {
          const dsRaw = new DecompressionStream('deflate-raw');
          const writer = dsRaw.writable.getWriter();
          // Skip zlib 2-byte header if deflate-raw
          const rawBytes = uint8Bytes.length > 2 ? uint8Bytes.slice(2) : uint8Bytes;
          writer.write(rawBytes);
          writer.close();
          const response = new Response(dsRaw.readable);
          const arrayBuf = await response.arrayBuffer();
          const decoder = new TextDecoder('latin1');
          return decoder.decode(arrayBuf);
        } catch (e2) {}
      }
    }

    // Fallback latin1 decode
    const decoder = new TextDecoder('latin1');
    return decoder.decode(uint8Bytes);
  }

  /**
   * Main text extraction method from ArrayBuffer or Uint8Array
   */
  static async extractText(pdfBuffer) {
    const uint8 = pdfBuffer instanceof Uint8Array ? pdfBuffer : new Uint8Array(pdfBuffer);
    const decoder = new TextDecoder('latin1');
    const binary = decoder.decode(uint8);

    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match;
    let allText = [];

    while ((match = streamRegex.exec(binary)) !== null) {
      const raw = match[1];
      let streamBytes;

      if (raw.includes('~>') || /^[!-u\s]{8,}~>/.test(raw.trim())) {
        try {
          streamBytes = this.decodeAscii85(raw);
        } catch (e) {
          const enc = new TextEncoder();
          streamBytes = enc.encode(raw);
        }
      } else {
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) {
          bytes[i] = raw.charCodeAt(i) & 0xff;
        }
        streamBytes = bytes;
      }

      let decompressed = '';
      try {
        decompressed = await this.decompressDeflate(streamBytes);
      } catch (e) {
        decompressed = decoder.decode(streamBytes);
      }

      // Extract text from text blocks: BT ... ET
      const btRegex = /BT[\s\S]*?ET/g;
      const blocks = decompressed.match(btRegex) || [decompressed];

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

        // 3. Hex strings <48656c6c6f> Tj
        const hexRegex = /<([0-9a-fA-F\s]+)>\s*Tj/g;
        let hexMatch;
        while ((hexMatch = hexRegex.exec(block)) !== null) {
          const hex = hexMatch[1].replace(/\s+/g, '');
          let decoded = '';
          for (let i = 0; i < hex.length; i += 2) {
            decoded += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
          }
          if (decoded.trim()) allText.push(decoded.trim());
        }
      }
    }

    // Fallback to ASCII string scan if streams were not standard
    if (allText.length < 5) {
      const rawMatches = binary.match(/\(([^)]{4,})\)/g) || [];
      for (const m of rawMatches) {
        const s = m.slice(1, -1).trim();
        if (/^[a-zA-Z0-9\s.,$%:;'"()\-–—]{5,}$/.test(s)) {
          allText.push(s);
        }
      }
    }

    return allText.join(' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Fetch PDF from URL and extract text
   */
  static async extractFromUrl(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuf = await res.arrayBuffer();
      return await this.extractText(arrayBuf);
    } catch (err) {
      // Direct fetch failed
      return '';
    }
  }
}

if (typeof window !== 'undefined') {
  window.ProspectusPDFExtractor = PDFExtractor;
}
