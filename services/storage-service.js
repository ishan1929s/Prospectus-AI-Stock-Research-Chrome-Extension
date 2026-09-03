/**
 * Prospectus - Storage Service
 * Typed wrapper for chrome.storage.local with defaults and offline-safe fallback.
 */

const DEFAULT_SETTINGS = {
  aiProvider: 'openai', // 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'custom'
  apiKey: '',
  modelName: 'gpt-4o-mini',
  customEndpoint: '',
  temperature: 0.2,
  licenseKey: '',
  isLicensed: false,
  enableBackgroundWatchlist: true,
  watchlistRefreshHours: 24,
  theme: 'light', // 'light' (warm cream) | 'dark'
  sidebarWidth: 440, // pixels (340 to 850)
  deepResearchHeight: 220, // pixels (120 to 550)
};

class StorageService {
  constructor() {
    this.isExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  async get(keys) {
    if (this.isExtension) {
      return new Promise((resolve) => {
        chrome.storage.local.get(keys, (items) => resolve(items || {}));
      });
    }
    // Fallback for mock/browser preview
    const res = {};
    const keyList = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys || {});
    for (const k of keyList) {
      try {
        const val = localStorage.getItem(`prospectus_${k}`);
        res[k] = val ? JSON.parse(val) : (keys && typeof keys === 'object' ? keys[k] : undefined);
      } catch (e) {
        res[k] = undefined;
      }
    }
    return res;
  }

  async set(items) {
    if (this.isExtension) {
      return new Promise((resolve) => {
        chrome.storage.local.set(items, () => resolve());
      });
    }
    // Fallback for mock/browser preview
    for (const [k, v] of Object.entries(items)) {
      try {
        localStorage.setItem(`prospectus_${k}`, JSON.stringify(v));
      } catch (e) {
        console.error('Storage save error:', e);
      }
    }
  }

  // --- Settings ---
  async getSettings() {
    const data = await this.get('settings');
    return { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  }

  async saveSettings(partial) {
    const current = await this.getSettings();
    const updated = { ...current, ...partial };
    await this.set({ settings: updated });
    return updated;
  }

  // --- License & Access ---
  async getUsageInfo() {
    const settings = await this.getSettings();
    const isLicensed = !!settings.isLicensed && !!(settings.licenseKey && settings.licenseKey.trim());
    return {
      isLicensed,
      licenseKey: settings.licenseKey || '',
    };
  }

  // --- Filing Snapshots (For "What Changed" Diff Engine) ---
  async getFilingSnapshot(ticker, formType, period) {
    const key = `snapshot_${ticker.toUpperCase()}_${formType}_${period}`.replace(/[^a-zA-Z0-9_]/g, '_');
    const data = await this.get(key);
    return data[key] || null;
  }

  async saveFilingSnapshot(ticker, formType, period, snapshotData) {
    const key = `snapshot_${ticker.toUpperCase()}_${formType}_${period}`.replace(/[^a-zA-Z0-9_]/g, '_');
    const indexKey = `snapshots_index_${ticker.toUpperCase()}`;
    
    // Save the snapshot payload
    await this.set({
      [key]: {
        ...snapshotData,
        ticker: ticker.toUpperCase(),
        formType,
        period,
        savedAt: new Date().toISOString(),
      },
    });

    // Update the index of snapshots for this ticker
    const idxData = await this.get(indexKey);
    const list = idxData[indexKey] || [];
    const exists = list.find((item) => item.formType === formType && item.period === period);
    if (!exists) {
      list.unshift({ key, formType, period, savedAt: new Date().toISOString() });
      await this.set({ [indexKey]: list });
    }
  }

  async getFilingHistory(ticker) {
    const indexKey = `snapshots_index_${ticker.toUpperCase()}`;
    const idxData = await this.get(indexKey);
    return idxData[indexKey] || [];
  }

  // --- Notebook ---
  async getNotebookEntries(tickerFilter = null) {
    const data = await this.get('notebook_entries');
    const entries = data.notebook_entries || [];
    if (!tickerFilter) return entries;
    return entries.filter((e) => (e.ticker || '').toUpperCase() === tickerFilter.toUpperCase());
  }

  async saveNotebookEntry(entry) {
    const data = await this.get('notebook_entries');
    const entries = data.notebook_entries || [];
    const newEntry = {
      id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      ticker: (entry.ticker || 'GENERIC').toUpperCase(),
      company: entry.company || '',
      note: entry.note || '',
      quote: entry.quote || '',
      sourceUrl: entry.sourceUrl || '',
      sourceTitle: entry.sourceTitle || '',
      filingPeriod: entry.filingPeriod || '',
      tags: entry.tags || [],
      createdAt: new Date().toISOString(),
      ...entry,
    };
    entries.unshift(newEntry);
    await this.set({ notebook_entries: entries });
    return newEntry;
  }

  async deleteNotebookEntry(entryId) {
    const data = await this.get('notebook_entries');
    const entries = (data.notebook_entries || []).filter((e) => e.id !== entryId);
    await this.set({ notebook_entries: entries });
    return entries;
  }

  // Find related topics in notebook for auto cross-referencing
  async findCrossReferences(ticker, text) {
    const entries = await this.getNotebookEntries(ticker);
    if (!entries.length || !text) return [];
    
    const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    if (!words.length) return [];
    
    const matches = [];
    for (const entry of entries) {
      const entryText = `${entry.quote} ${entry.note} ${(entry.tags || []).join(' ')}`.toLowerCase();
      let matchCount = 0;
      for (const w of words) {
        if (entryText.includes(w)) matchCount++;
      }
      if (matchCount >= 2 || (words.length < 3 && matchCount >= 1)) {
        matches.push({
          entry,
          score: matchCount,
        });
      }
    }
    return matches.sort((a, b) => b.score - a.score).map((m) => m.entry);
  }

  // --- Watchlist ---
  async getWatchlist() {
    const data = await this.get('watchlist_items');
    return data.watchlist_items || [];
  }

  async addToWatchlist(item) {
    const list = await this.getWatchlist();
    const upper = (item.ticker || '').toUpperCase();
    if (!upper) return list;
    if (list.some((i) => i.ticker.toUpperCase() === upper)) return list;
    
    const newItem = {
      ticker: upper,
      company: item.company || upper,
      sector: item.sector || 'General',
      exchange: item.exchange || 'US',
      addedAt: new Date().toISOString(),
      lastDigest: item.lastDigest || 'Tracked. Click "Check Now" for latest digest.',
      lastChecked: 'Just now',
    };
    list.unshift(newItem);
    await this.set({ watchlist_items: list });
    return list;
  }

  async removeFromWatchlist(ticker) {
    const list = await this.getWatchlist();
    const updated = list.filter((i) => i.ticker.toUpperCase() !== (ticker || '').toUpperCase());
    await this.set({ watchlist_items: updated });
    return updated;
  }

  async updateWatchlistDigest(ticker, digestText) {
    const list = await this.getWatchlist();
    const updated = list.map((i) => {
      if (i.ticker.toUpperCase() === ticker.toUpperCase()) {
        return {
          ...i,
          lastDigest: digestText,
          lastChecked: 'Just now',
        };
      }
      return i;
    });
    await this.set({ watchlist_items: updated });
    return updated;
  }
}

// Export for module systems and global for content scripts/service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageService, DEFAULT_SETTINGS };
}
if (typeof window !== 'undefined') {
  window.ProspectusStorage = new StorageService();
}
