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
  watchlistScheduleInterval: 1440, // minutes (30, 60, 120, 240, 480, 1440, or 0 for off)
  theme: 'light', // 'light' (warm cream) | 'dark'
  sidebarWidth: 440, // pixels (340 to 850)
  deepResearchHeight: 240, // pixels (120 to 650)
  dockToggleTopPercent: 50, // vertical position percent along right side (5% to 95%)
};

class StorageService {
  constructor() {
    this.isExtension = false;
    try {
      this.isExtension = typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
    } catch (e) {
      this.isExtension = false;
    }
  }

  isContextValid() {
    try {
      if (typeof chrome === 'undefined') return false;
      if (!chrome.runtime || !chrome.runtime.id) return false;
      if (!chrome.storage || !chrome.storage.local) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  async get(keys) {
    let result = {};
    const keyList = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys || {});

    if (this.isContextValid()) {
      try {
        result = await new Promise((resolve) => {
          try {
            if (!this.isContextValid()) {
              resolve({});
              return;
            }
            chrome.storage.local.get(keys, (items) => {
              try {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.runtime.lastError) {
                  resolve({});
                } else {
                  resolve(items || {});
                }
              } catch (err) {
                resolve({});
              }
            });
          } catch (e) {
            resolve({});
          }
        });
      } catch (e) {
        result = {};
      }
    }

    const fallback = this.getFallback(keyList);
    const combined = { ...fallback, ...result };

    // If chrome storage returned empty array for a key, but fallback has stored items, prioritize fallback
    for (const k of keyList) {
      if ((!combined[k] || (Array.isArray(combined[k]) && combined[k].length === 0)) && fallback[k] && Array.isArray(fallback[k]) && fallback[k].length > 0) {
        combined[k] = fallback[k];
      }
    }

    return combined;
  }

  async set(items) {
    // 1. Always mirror to localStorage fallback immediately so page refreshes and standalone demo pages never lose data
    this.setFallback(items);

    // 2. Persist to chrome.storage.local if extension context is active
    if (this.isContextValid()) {
      try {
        await new Promise((resolve) => {
          try {
            if (!this.isContextValid()) {
              resolve();
              return;
            }
            chrome.storage.local.set(items, () => {
              try {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.runtime.lastError) {}
              } catch (e) {}
              resolve();
            });
          } catch (e) {
            resolve();
          }
        });
      } catch (e) {}
    }
  }

  async remove(keys) {
    try {
      if (this.isContextValid()) {
        return await new Promise((resolve) => {
          try {
            if (!this.isContextValid()) {
              this.removeFallback(keys);
              resolve();
              return;
            }
            chrome.storage.local.remove(keys, () => {
              try {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.runtime.lastError) {}
              } catch (e) {}
              resolve();
            });
          } catch (err) {
            this.removeFallback(keys);
            resolve();
          }
        });
      }
    } catch (e) {
      this.removeFallback(keys);
      return;
    }
    this.removeFallback(keys);
  }

  getFallback(keys) {
    const res = {};
    const keyList = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys || {});
    for (const k of keyList) {
      try {
        const val = typeof localStorage !== 'undefined' ? localStorage.getItem(`prospectus_${k}`) : null;
        res[k] = val ? JSON.parse(val) : (keys && typeof keys === 'object' ? keys[k] : undefined);
      } catch (e) {
        res[k] = undefined;
      }
    }
    return res;
  }

  setFallback(items) {
    for (const [k, v] of Object.entries(items || {})) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`prospectus_${k}`, JSON.stringify(v));
        }
      } catch (e) {
        console.warn('Fallback storage set warning:', e.message);
      }
    }
  }

  removeFallback(keys) {
    const keyList = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : [];
    for (const k of keyList) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(`prospectus_${k}`);
        }
      } catch (e) {
        // ignore
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

  // --- Filing & Page Snapshots (For "What Changed" Diff Engine) ---
  async getFilingSnapshot(ticker, formType, period) {
    const cleanTicker = (ticker || 'PAGE').toUpperCase();
    const cleanPeriod = (period || 'latest').replace(/[^a-zA-Z0-9_]/g, '_');
    const key = `snapshot_${cleanTicker}_${formType || 'Doc'}_${cleanPeriod}`.replace(/[^a-zA-Z0-9_]/g, '_');
    const data = await this.get(key);
    return data[key] || null;
  }

  async saveFilingSnapshot(scopeKey, formType, period, snapshotData) {
    const cleanScope = (scopeKey || 'SITE_PAGE').replace(/[^a-zA-Z0-9_]/g, '_');
    const nowIso = new Date().toISOString();
    const periodLabel = period || new Date().toLocaleString();
    const cleanPeriod = (period || 'snapshot_' + Date.now()).replace(/[^a-zA-Z0-9_]/g, '_');
    const key = `snapshot_${cleanScope}_${cleanPeriod}`;
    const indexKey = `snapshots_index_${cleanScope}`;
    
    // Save the snapshot payload
    await this.set({
      [key]: {
        ...snapshotData,
        scopeKey: cleanScope,
        formType: formType || 'Document',
        period: periodLabel,
        savedAt: nowIso,
        url: typeof window !== 'undefined' ? window.location.href : '',
        hostname: typeof window !== 'undefined' ? window.location.hostname : '',
      },
    });

    // Update the index of snapshots for this specific website/scope ONLY
    const idxData = await this.get(indexKey);
    const list = idxData[indexKey] || [];
    const exists = list.find((item) => item.key === key);
    if (!exists) {
      list.unshift({ key, formType: formType || 'Document', period: periodLabel, savedAt: nowIso, scopeKey: cleanScope });
      await this.set({ [indexKey]: list });
    }
    return { key, period: periodLabel };
  }

  async getFilingHistory(scopeKey) {
    const cleanScope = (scopeKey || 'SITE_PAGE').replace(/[^a-zA-Z0-9_]/g, '_');
    const indexKey = `snapshots_index_${cleanScope}`;
    const idxData = await this.get(indexKey);
    return idxData[indexKey] || [];
  }

  async clearFilingHistory(scopeKey) {
    const cleanScope = (scopeKey || 'SITE_PAGE').replace(/[^a-zA-Z0-9_]/g, '_');
    const indexKey = `snapshots_index_${cleanScope}`;
    const idxData = await this.get(indexKey);
    const list = idxData[indexKey] || [];
    const keysToRemove = [indexKey, ...list.map((item) => item.key)];
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove(keysToRemove);
    }
    return true;
  }

  // --- Notebook ---
  async getNotebookEntries(tickerFilter = null) {
    const data = await this.get('notebook_entries');
    let entries = Array.isArray(data.notebook_entries) ? data.notebook_entries : [];

    // Auto-repair any entries that have missing or non-string IDs
    let repaired = false;
    entries = entries.map((e, idx) => {
      if (!e || typeof e !== 'object') return null;
      if (!e.id || typeof e.id !== 'string') {
        repaired = true;
        return {
          ...e,
          id: 'note_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 6),
        };
      }
      return e;
    }).filter(Boolean);

    if (repaired) {
      await this.set({ notebook_entries: entries });
    }

    if (!tickerFilter) return entries;
    return entries.filter((e) => (e.ticker || '').toUpperCase() === tickerFilter.toUpperCase());
  }

  async saveNotebookEntry(entry = {}) {
    const data = await this.get('notebook_entries');
    let entries = Array.isArray(data.notebook_entries) ? [...data.notebook_entries] : [];

    // Guarantee a valid, unique string ID
    const entryId = (entry.id && typeof entry.id === 'string' && entry.id.trim())
      ? entry.id.trim()
      : ('note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));

    const finalEntry = {
      title: 'Research Note',
      category: 'General',
      ticker: 'PAGE',
      company: '',
      note: '',
      quote: '',
      sourceUrl: '',
      sourceTitle: '',
      filingPeriod: '',
      tags: [],
      createdAt: new Date().toISOString(),
      ...entry,
      id: entryId, // MUST come after ...entry so it cannot be overwritten by undefined!
    };

    finalEntry.ticker = (finalEntry.ticker || 'PAGE').toUpperCase();

    // Check if an existing entry actually has this non-empty ID
    const existingIndex = entries.findIndex((e) => e && e.id && e.id === entryId);
    if (existingIndex >= 0) {
      entries[existingIndex] = {
        ...entries[existingIndex],
        ...finalEntry,
        updatedAt: new Date().toISOString(),
      };
    } else {
      entries.unshift(finalEntry);
    }

    await this.set({ notebook_entries: entries });
    return finalEntry;
  }

  async updateNotebookEntry(entryId, updatedFields) {
    if (!entryId) return null;
    const data = await this.get('notebook_entries');
    const entries = Array.isArray(data.notebook_entries) ? [...data.notebook_entries] : [];
    const index = entries.findIndex(e => e && e.id && e.id === entryId);
    if (index >= 0) {
      entries[index] = { ...entries[index], ...updatedFields, updatedAt: new Date().toISOString() };
      await this.set({ notebook_entries: entries });
      return entries[index];
    }
    return null;
  }

  async deleteNotebookEntry(entryId) {
    if (!entryId) return [];
    const data = await this.get('notebook_entries');
    const entries = (Array.isArray(data.notebook_entries) ? data.notebook_entries : []).filter((e) => e && e.id && e.id !== entryId);
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

  async saveWatchlist(list) {
    await this.set({ watchlist_items: list || [] });
    return list;
  }

  async addToWatchlist(item) {
    const list = await this.getWatchlist();
    const upper = (item.ticker || '').toUpperCase();
    if (!upper) return list;
    if (list.some((i) => (typeof i === 'string' ? i : i.ticker).toUpperCase() === upper)) return list;
    
    const newItem = {
      ticker: upper,
      company: item.company || upper,
      sector: item.sector || 'General',
      exchange: item.exchange || 'US',
      addedAt: new Date().toISOString(),
      lastDigest: {
        tag: 'Quiet',
        summary: item.lastDigest || 'Tracked. Click "Check Now" for latest digest.',
        date: 'Today',
      },
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
