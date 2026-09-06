/**
 * Prospectus - Storage Service
 * Typed wrapper for chrome.storage.local with defaults and offline-safe fallback.
 */

const DEFAULT_SETTINGS = {
  aiProvider: 'anthropic', // 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'custom'
  apiKey: '',
  modelName: 'claude-sonnet-5',
  customEndpoint: '',
  temperature: 0.2,
  analysisMode: 'fast', // 'fast' (Token-Saver) | 'deep' (Institutional Deep)
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

  canUseFallback() {
    // SECURITY: NEVER use localStorage fallback if running within an injected content script on a webpage.
    // Webpage localStorage is visible to any third-party scripts on that domain and would leak API keys and sensitive settings.
    // Only allow localStorage fallback in standalone extension pages (chrome-extension://) or local dev when chrome.storage is unavailable.
    try {
      if (this.isContextValid()) {
        return false; // Extension storage is active; no fallback needed or permitted
      }
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return false;
      }
      if (window.location && window.location.protocol) {
        return window.location.protocol === 'chrome-extension:' || window.location.protocol === 'file:';
      }
      return false;
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
        return result;
      } catch (e) {
        result = {};
      }
    }

    if (this.canUseFallback()) {
      const fallback = this.getFallback(keyList);
      return { ...fallback, ...result };
    }

    return result;
  }

  async set(items) {
    // 1. Persist to chrome.storage.local if extension context is active
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
        return;
      } catch (e) {}
    }

    // 2. Only fallback if permitted (standalone extension page or local mock environment)
    if (this.canUseFallback()) {
      this.setFallback(items);
    }
  }

  async remove(keys) {
    if (this.isContextValid()) {
      try {
        return await new Promise((resolve) => {
          try {
            if (!this.isContextValid()) {
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
            resolve();
          }
        });
      } catch (e) {
        return;
      }
    }

    if (this.canUseFallback()) {
      this.removeFallback(keys);
    }
  }

  getFallback(keys) {
    if (!this.canUseFallback()) return {};
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
    if (!this.canUseFallback()) return;
    for (const [k, v] of Object.entries(items || {})) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`prospectus_${k}`, JSON.stringify(v));
        }
      } catch (e) {
        // Fallback storage failure handled silently
      }
    }
  }

  removeFallback(keys) {
    if (!this.canUseFallback()) return;
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
    const key = (settings.licenseKey || '').trim().toUpperCase();
    const isLicensed = !!settings.isLicensed && !!key && (
      typeof LicenseService !== 'undefined'
        ? LicenseService.isKeyValid(key)
        : (['PRS-8F2A-4D9C-7B1E', 'PRS-5E3B-9A7D-2C6F'].includes(key) || /^PRS-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(key))
    );
    return {
      isLicensed,
      licenseKey: isLicensed ? key : '',
    };
  }

  // --- Analysis Cache (Preserves analysis when switching tabs or changing options) ---
  _normalizeUrlKey(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    try {
      const u = new URL(rawUrl);
      return (u.origin + u.pathname + u.search).replace(/#.*$/, '').slice(0, 300);
    } catch (e) {
      return rawUrl.replace(/#.*$/, '').slice(0, 300);
    }
  }

  async getAnalysisCache(url) {
    const norm = this._normalizeUrlKey(url);
    if (!norm) return null;
    const key = `analysis_cache_${norm}`.replace(/[^a-zA-Z0-9_]/g, '_');
    const data = await this.get(key);
    return data[key] || null;
  }

  async saveAnalysisCache(url, cacheData) {
    const norm = this._normalizeUrlKey(url);
    if (!norm || !cacheData) return;
    const key = `analysis_cache_${norm}`.replace(/[^a-zA-Z0-9_]/g, '_');
    await this.set({
      [key]: {
        ...cacheData,
        savedAt: Date.now(),
      }
    });
  }

  async clearAnalysisCache(url) {
    const norm = this._normalizeUrlKey(url);
    if (!norm) return;
    const key = `analysis_cache_${norm}`.replace(/[^a-zA-Z0-9_]/g, '_');
    await this.remove(key);
  }

  // --- Filing & Page Snapshots (For "What Changed" Diff Engine) ---
  getSnapshotScopeKey(pageData, activeFilingContext = null) {
    if (activeFilingContext && activeFilingContext.ticker) {
      return `filing_${activeFilingContext.ticker.toUpperCase().replace(/[^a-zA-Z0-9]/g, '_')}`;
    }
    if (pageData && pageData.ticker && pageData.ticker !== 'PAGE' && pageData.ticker !== 'PDF' && pageData.ticker !== 'QUOTE' && pageData.ticker !== 'ARTICLE') {
      const ticker = pageData.ticker.toUpperCase().replace(/[^a-zA-Z0-9]/g, '_');
      const formType = (pageData.formType || 'Doc').replace(/[^a-zA-Z0-9]/g, '_');
      return `stock_${ticker}_${formType}`;
    }
    const rawUrl = pageData?.url || (typeof window !== 'undefined' ? window.location.href : '');
    const norm = this._normalizeUrlKey(rawUrl) || 'page';
    return `doc_${norm.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 70)}`;
  }

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
        url: snapshotData?.url || (typeof window !== 'undefined' ? window.location.href : ''),
        hostname: typeof window !== 'undefined' ? window.location.hostname : '',
      },
    });

    // Update the index of snapshots for this specific website/scope ONLY
    const idxData = await this.get(indexKey);
    let list = idxData[indexKey] || [];
    const exists = list.find((item) => item.key === key);
    if (!exists) {
      list.unshift({ key, formType: formType || 'Document', period: periodLabel, savedAt: nowIso, scopeKey: cleanScope });
      if (list.length > 20) {
        const toPrune = list.slice(20);
        list = list.slice(0, 20);
        await this.remove(toPrune.map(p => p.key));
      }
      await this.set({ [indexKey]: list });
    }
    return { key, period: periodLabel };
  }

  async autoRecordSnapshot({ scopeKey, pageData, summaryResult, formType, aiService } = {}) {
    try {
      if (!pageData || pageData.isYouTube) return null;
      const key = scopeKey || this.getSnapshotScopeKey(pageData);
      if (!key) return null;

      const currentText = pageData.fullText || pageData.riskFactorsText || pageData.extractedText || pageData.bodyText || pageData.company || '';
      if (!currentText || currentText.trim().length < 20) return null;

      const currentPeriod = pageData.periodBadge || pageData.filingDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const history = await this.getFilingHistory(key);

      const getItems = () => {
        if (summaryResult && Array.isArray(summaryResult.whatChanged) && summaryResult.whatChanged.length > 0) {
          return summaryResult.whatChanged;
        }
        if (aiService && typeof aiService.extractDynamicWhatChanged === 'function') {
          return aiService.extractDynamicWhatChanged({
            text: currentText,
            company: pageData.company || 'Company',
            ticker: pageData.ticker || 'TICKER',
            formType: pageData.formType || 'Report',
          });
        }
        return [];
      };

      // 1. FIRST VISIT: No prior history exists -> Automatically save Initial Baseline in background
      if (!history || history.length === 0) {
        const baselinePeriod = `Initial Baseline · ${currentPeriod}`;
        const items = getItems();
        return await this.saveFilingSnapshot(key, formType || pageData.formType || 'Document', baselinePeriod, {
          text: currentText,
          savedAt: new Date().toISOString(),
          summary: summaryResult ? (summaryResult.overview || '') : '',
          whatChanged: items,
          isBaseline: true,
          url: pageData.url || (typeof window !== 'undefined' ? window.location.href : ''),
          company: pageData.company || pageData.ticker || 'Document',
          ticker: pageData.ticker || '',
        });
      }

      // 2. SUBSEQUENT VISIT: History exists -> Check if content or analysis updated
      const latestItem = history[0];
      const latestData = await this.get(latestItem.key);
      const latestSnap = latestData ? latestData[latestItem.key] : null;

      if (latestSnap) {
        const items = getItems();

        // If latest snapshot lacked whatChanged but we now have items (e.g. from analysis), enrich it
        if ((!latestSnap.whatChanged || latestSnap.whatChanged.length === 0) && items.length > 0) {
          latestSnap.whatChanged = items;
          if (summaryResult && summaryResult.overview) latestSnap.summary = summaryResult.overview;
          await this.set({ [latestItem.key]: latestSnap });
        }

        // Check if content has materially changed from latest snapshot
        const oldText = latestSnap.text || '';
        const textChanged = (Math.abs(oldText.length - currentText.length) > 50) ||
                            (oldText.slice(0, 300) !== currentText.slice(0, 300));

        const timeDiff = Date.now() - new Date(latestSnap.savedAt).getTime();
        const minIntervalPassed = timeDiff > (3 * 60 * 1000); // 3 minutes debounce between auto revisions

        if (textChanged && minIntervalPassed) {
          const revPeriod = `Revision · ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          return await this.saveFilingSnapshot(key, formType || pageData.formType || 'Document', revPeriod, {
            text: currentText,
            savedAt: new Date().toISOString(),
            whatChanged: items,
            isBaseline: false,
            url: pageData.url || (typeof window !== 'undefined' ? window.location.href : ''),
            company: pageData.company || pageData.ticker || 'Document',
            ticker: pageData.ticker || '',
          });
        }
      }

      return null;
    } catch (err) {
      return null;
    }
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
