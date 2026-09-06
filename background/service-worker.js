/**
 * Prospectus - Manifest V3 Background Service Worker
 * Manages context menus, alarms, keyboard shortcuts, and tab messaging.
 */

// Global error handlers for background worker to catch benign extension channel disconnects
self.addEventListener('unhandledrejection', (event) => {
  const msg = (event && event.reason && (event.reason.message || String(event.reason))) || '';
  if (
    msg.includes('Extension context invalidated') ||
    msg.includes('message port closed') ||
    msg.includes('Receiving end does not exist')
  ) {
    event.preventDefault();
  }
});

self.addEventListener('error', (event) => {
  const msg = (event && event.message) || '';
  if (
    msg.includes('Extension context invalidated') ||
    msg.includes('message port closed') ||
    msg.includes('Receiving end does not exist')
  ) {
    event.preventDefault();
  }
});

// Initialize context menus and alarms on extension install
chrome.runtime.onInstalled.addListener(async () => {
  // Context menus - clear first and handle lastError to avoid duplicate ID errors
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) { /* ignore */ }
    chrome.contextMenus.create({
      id: 'prospectus-explain',
      title: 'Explain "%s" with Prospectus',
      contexts: ['selection'],
    }, () => {
      if (chrome.runtime.lastError) { /* ignore */ }
    });

    chrome.contextMenus.create({
      id: 'prospectus-save-note',
      title: 'Save "%s" to Prospectus Notebook',
      contexts: ['selection'],
    }, () => {
      if (chrome.runtime.lastError) { /* ignore */ }
    });
  });

  // Watchlist background alarm initialization
  try {
    const storage = new StorageService();
    const settings = await storage.getSettings();
    const mins = settings.watchlistScheduleInterval !== undefined
      ? settings.watchlistScheduleInterval
      : (settings.enableBackgroundWatchlist !== false ? 1440 : 0);

    if (mins > 0) {
      chrome.alarms.create('prospectus-watchlist-alarm', {
        periodInMinutes: mins,
      });
      console.log(`Prospectus: Initialized watchlist alarm with interval of ${mins} minutes.`);
    }
  } catch (e) {
    chrome.alarms.create('prospectus-watchlist-alarm', {
      periodInMinutes: 1440,
    });
  }
});

function isExcludedUrl(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  return (
    lower.includes('youtube.com') ||
    lower.includes('youtu.be') ||
    /\.(xml|xsd|json|txt|csv)($|\?)/i.test(lower) ||
    lower.startsWith('chrome://') ||
    lower.startsWith('edge://') ||
    lower.startsWith('about:')
  );
}

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id || isExcludedUrl(tab.url)) return;

  if (info.menuItemId === 'prospectus-explain') {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'OPEN_EXPLAIN',
        term: info.selectionText,
      });
    } catch (err) {
      await injectAndSendMessage(tab.id, {
        action: 'OPEN_EXPLAIN',
        term: info.selectionText,
      });
    }
  } else if (info.menuItemId === 'prospectus-save-note') {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'SAVE_NOTE',
        text: info.selectionText,
      });
    } catch (err) {
      await injectAndSendMessage(tab.id, {
        action: 'SAVE_NOTE',
        text: info.selectionText,
      });
    }
  }
});

// Handle Keyboard Shortcuts (commands)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-panel') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id && !isExcludedUrl(tab.url)) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_PANEL' });
      } catch (err) {
        await injectAndSendMessage(tab.id, { action: 'TOGGLE_PANEL' });
      }
    }
  }
});

try {
  importScripts(
    '/services/storage-service.js',
    '/services/ai-service.js',
    '/services/pdf-extractor.js',
    '/services/us-stocks.js',
    '/services/watchlist-service.js'
  );
} catch (e) {}

function openSettingsPage() {
  const optionsUrl = chrome.runtime.getURL('options/options.html');
  try {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage(() => {
        if (chrome.runtime.lastError) {
          chrome.tabs.query({}, (tabs) => {
            const existing = (tabs || []).find((t) => t.url && t.url.includes('options/options.html'));
            if (existing) {
              chrome.tabs.update(existing.id, { active: true });
              if (existing.windowId) chrome.windows.update(existing.windowId, { focused: true }).catch(() => {});
            } else {
              chrome.tabs.create({ url: optionsUrl });
            }
          });
        }
      });
      return;
    }
  } catch (e) {}

  chrome.tabs.query({}, (tabs) => {
    const existing = (tabs || []).find((t) => t.url && t.url.includes('options/options.html'));
    if (existing) {
      chrome.tabs.update(existing.id, { active: true });
      if (existing.windowId) chrome.windows.update(existing.windowId, { focused: true }).catch(() => {});
    } else {
      chrome.tabs.create({ url: optionsUrl });
    }
  });
}

// Message listener for actions from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && (message.action === 'OPEN_OPTIONS' || message.action === 'OPEN_SETTINGS')) {
    openSettingsPage();
    sendResponse({ success: true });
    return true;
  }

  // Clear Toolbar Badge
  if (message && message.action === 'CLEAR_DIGEST_BADGE') {
    chrome.action.setBadgeText({ text: '' }).catch(() => {});
    sendResponse({ success: true });
    return true;
  }

  // Run Watchlist Digest Pass on demand
  if (message && message.action === 'RUN_WATCHLIST_DIGEST') {
    (async () => {
      try {
        const storage = new StorageService();
        const ai = new AIService(storage);
        const watchlistService = new WatchlistService(storage, ai);
        const res = await watchlistService.runDigestPass(!!message.forceAll);
        sendResponse({ success: true, result: res });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // Handle Background PDF Text Extraction
  if (message && message.action === 'FETCH_PDF_TEXT') {
    (async () => {
      try {
        const { url } = message;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arrayBuf = await res.arrayBuffer();
        const text = await PDFExtractor.extractText(arrayBuf);
        sendResponse({ success: true, text: text });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // Handle Background Proxy Fetch (Bypasses website Content Security Policies & CORS restrictions)
  if (message && message.action === 'FETCH_PROXY') {
    (async () => {
      try {
        const { url, options = {} } = message;
        
        // Determine dynamic timeout: 90s for LLM AI endpoints & deep research, 10s for standard quotes/search
        const isAiEndpoint =
          url.includes('api.openai.com') ||
          url.includes('api.anthropic.com') ||
          url.includes('generativelanguage.googleapis.com') ||
          url.includes('openrouter.ai') ||
          url.includes('/chat/completions') ||
          url.includes('/messages') ||
          url.includes('/models/');
        const defaultTimeout = isAiEndpoint ? 90000 : 10000;
        const requestTimeout = typeof options.timeout === 'number' ? options.timeout : defaultTimeout;

        // Helper to attempt fetch with timeout
        const tryFetch = async (targetUrl) => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), requestTimeout);
          try {
            const res = await fetch(targetUrl, { ...options, signal: controller.signal });
            clearTimeout(timer);
            return res;
          } catch (e) {
            clearTimeout(timer);
            if (e.name === 'AbortError') {
              throw new Error(`Request timed out after ${Math.round(requestTimeout / 1000)} seconds. Please verify your network connection or API service status.`);
            }
            throw e;
          }
        };

        let res = null;
        try {
          res = await tryFetch(url);
        } catch (firstErr) {
          // Automatic failover for Yahoo Finance query hosts
          if (url.includes('query1.finance.yahoo.com')) {
            const fallbackUrl = url.replace('query1.finance.yahoo.com', 'query2.finance.yahoo.com');
            try {
              res = await tryFetch(fallbackUrl);
            } catch (secondErr) {
              throw firstErr;
            }
          } else if (url.includes('query2.finance.yahoo.com')) {
            const fallbackUrl = url.replace('query2.finance.yahoo.com', 'query1.finance.yahoo.com');
            try {
              res = await tryFetch(fallbackUrl);
            } catch (secondErr) {
              throw firstErr;
            }
          } else {
            throw firstErr;
          }
        }

        const text = await res.text();
        let data = null;
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = null;
        }

        sendResponse({
          success: true,
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
          data: data,
          text: text,
        });
      } catch (err) {
        sendResponse({
          success: false,
          error: err.message || 'Background network fetch failed',
        });
      }
    })();
    return true; // Keep message port open for async response
  }

  // Handle Watchlist Alarm Scheduling Updates
  if (message && message.action === 'UPDATE_WATCHLIST_ALARM') {
    const mins = typeof message.intervalMinutes === 'number' ? message.intervalMinutes : 1440;
    try {
      chrome.alarms.clear('prospectus-watchlist-alarm', () => {
        if (mins > 0) {
          chrome.alarms.create('prospectus-watchlist-alarm', {
            periodInMinutes: mins,
            delayInMinutes: mins,
          });
          console.log(`Prospectus: Scheduled watchlist alarm set to every ${mins} minutes.`);
        } else {
          console.log('Prospectus: Scheduled watchlist alarm cleared (manual only).');
        }
      });
      sendResponse({ success: true, intervalMinutes: mins });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  // Handle Background Ticker Search across 10,400+ US Stocks Registry
  if (message && message.action === 'SEARCH_TICKERS') {
    (async () => {
      try {
        const storage = new StorageService();
        const ai = new AIService(storage);
        const ws = new WatchlistService(storage, ai);
        const results = await ws.searchTickers(message.query, message.limit || 8);
        sendResponse({ success: true, results: results || [] });
      } catch (err) {
        sendResponse({ success: false, error: err.message, results: [] });
      }
    })();
    return true;
  }

  // Handle Background Stock Resolution (CIK, Name, Exchange)
  if (message && message.action === 'RESOLVE_STOCK_INFO') {
    (async () => {
      try {
        const storage = new StorageService();
        const ai = new AIService(storage);
        const ws = new WatchlistService(storage, ai);
        const info = ws.resolveStockInfo(message.ticker, message.defaultName);
        sendResponse({ success: true, info });
      } catch (err) {
        sendResponse({ success: false, error: err.message, info: null });
      }
    })();
    return true;
  }

  return true;
});

// Helper to inject content scripts on on-demand non-matching pages
async function injectAndSendMessage(tabId, message) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url || isExcludedUrl(tab.url)) {
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        'services/storage-service.js',
        'services/license-service.js',
        'services/ai-service.js',
        'services/pdf-extractor.js',
        'services/watchlist-service.js',
        'content/extractors.js',
        'content/diff-engine.js',
        'content/content.js',
      ],
    });
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, message).catch(() => {});
    }, 200);
  } catch (e) {
    // Silently ignore injection errors on restricted or non-HTML pages
  }
}

// Background alarm listener for Watchlist updates
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'prospectus-watchlist-alarm') {
    try {
      const storage = new StorageService();
      const settings = await storage.getSettings();
      if (settings.enableBackgroundWatchlist !== false) {
        console.log('Prospectus: Running scheduled background watchlist check.');
        const ai = new AIService(storage);
        const watchlistService = new WatchlistService(storage, ai);
        const res = await watchlistService.runDigestPass(false);

        if (res && res.updatedCount > 0) {
          await chrome.action.setBadgeText({ text: '•' });
          await chrome.action.setBadgeBackgroundColor({ color: '#cc785c' });

          if (settings.enableDesktopNotifications) {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: '/icons/icon-128.png',
              title: 'Prospectus Daily Digest Ready',
              message: `${res.updatedCount} tracked ticker${res.updatedCount > 1 ? 's have' : ' has'} new SEC filings or market updates.`,
            });
          }
        }
      }
    } catch (e) {
      // Alarm check failure handled silently
    }
  }
});
