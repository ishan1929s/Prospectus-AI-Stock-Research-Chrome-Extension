/**
 * Prospectus - Filing Diff & Redline Engine
 * Computes sentence-level redline comparisons between current and previous filing periods.
 */

class FilingDiffEngine {
  /**
   * Split a text block into sentences
   */
  static splitSentences(text) {
    if (!text) return [];
    return text
      .replace(/\r\n/g, '\n')
      .split(/(?<=[.?!])\s+(?=[A-Z0-9])/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /**
   * Compute sentence-level diff between baseline (old) and current (new) text
   */
  static computeDiff(oldText, newText) {
    const oldSentences = this.splitSentences(oldText);
    const newSentences = this.splitSentences(newText);

    const additions = [];
    const deletions = [];
    const chunks = [];

    // Fast longest common subsequence / sentence matching
    let oldIdx = 0;
    let newIdx = 0;

    const oldSet = new Set(oldSentences.map((s) => this.normalize(s)));
    const newSet = new Set(newSentences.map((s) => this.normalize(s)));

    for (let s of oldSentences) {
      if (!newSet.has(this.normalize(s))) {
        deletions.push(s);
      }
    }

    for (let s of newSentences) {
      if (!oldSet.has(this.normalize(s))) {
        additions.push(s);
      }
    }

    // Build visual chunk stream
    const processedOld = new Set();
    const processedNew = new Set();

    newSentences.forEach((s) => {
      const norm = this.normalize(s);
      if (oldSet.has(norm)) {
        chunks.push({ type: 'unchanged', text: s });
      } else {
        chunks.push({ type: 'added', text: s });
      }
    });

    // Add deleted sentences at relevant positions
    const finalChunks = [];
    let delIdx = 0;

    chunks.forEach((c) => {
      if (c.type === 'added' && delIdx < deletions.length) {
        finalChunks.push({ type: 'deleted', text: deletions[delIdx++] });
      }
      finalChunks.push(c);
    });

    while (delIdx < deletions.length) {
      finalChunks.push({ type: 'deleted', text: deletions[delIdx++] });
    }

    const similarity = this.calculateSimilarity(oldText, newText);

    return {
      additions,
      deletions,
      chunks: finalChunks,
      stats: {
        addedCount: additions.length,
        deletedCount: deletions.length,
        similarityPercent: Math.round(similarity * 100),
      },
    };
  }

  static normalize(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  static calculateSimilarity(s1, s2) {
    if (!s1 || !s2) return 0;
    const w1 = new Set(this.normalize(s1).split(' '));
    const w2 = new Set(this.normalize(s2).split(' '));
    const intersection = new Set([...w1].filter((x) => w2.has(x)));
    const union = new Set([...w1, ...w2]);
    return union.size === 0 ? 1 : intersection.size / union.size;
  }

  /**
   * Render HTML redline view from diff chunks
   */
  static renderRedlineHTML(diffResult) {
    if (!diffResult || !diffResult.chunks || !diffResult.chunks.length) {
      return '<div class="diff-empty">No baseline filing selected or no text changes found.</div>';
    }

    return diffResult.chunks
      .map((chunk) => {
        const escaped = this.escapeHTML(chunk.text);
        if (chunk.type === 'added') {
          return `<ins class="diff-add"><span class="diff-tag">+ADD</span> ${escaped}</ins> `;
        } else if (chunk.type === 'deleted') {
          return `<del class="diff-del"><span class="diff-tag">-DEL</span> ${escaped}</del> `;
        } else {
          return `<span class="diff-same">${escaped}</span> `;
        }
      })
      .join('\n');
  }

  static escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FilingDiffEngine };
}
if (typeof window !== 'undefined') {
  window.FilingDiffEngine = FilingDiffEngine;
}
