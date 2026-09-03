/**
 * Prospectus - Manifest V3 Background Service Worker
 * Manages context menus, alarms, keyboard shortcuts, and tab messaging.
 */

// Initialize context menus and alarms on extension install
chrome.runtime.onInstalled.addListener(async () => {
  // Context menus
  chrome.contextMenus.create({
    id: 'prospectus-explain',
    title: 'Explain "%s" with Prospectus',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'prospectus-save-note',
    title: 'Save "%s" to Prospectus Notebook',
    contexts: ['selection'],
  });

  // Watchlist background alarm (every 24 hours)
  chrome.alarms.create('prospectus-watchlist-alarm', {
    periodInMinutes: 1440,
  });
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;

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

// Handle Toolbar Icon Click (when no default_popup or on demand)
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_PANEL' });
  } catch (err) {
    await injectAndSendMessage(tab.id, { action: 'TOGGLE_PANEL' });
  }
});

// Handle Keyboard Shortcuts (commands)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-panel') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_PANEL' });
      } catch (err) {
        await injectAndSendMessage(tab.id, { action: 'TOGGLE_PANEL' });
      }
    }
  }
});

// Message listener for actions from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
  }
  return true;
});

// Helper to inject content scripts on on-demand non-matching pages
async function injectAndSendMessage(tabId, message) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        'services/storage-service.js',
        'services/license-service.js',
        'services/ai-service.js',
        'content/extractors.js',
        'content/diff-engine.js',
        'content/content.js',
      ],
    });
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, message).catch(() => {});
    }, 200);
  } catch (e) {
    console.error('Failed to inject Prospectus content script:', e);
  }
}

// Background alarm listener for Watchlist updates
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'prospectus-watchlist-alarm') {
    const { settings = {} } = await chrome.storage.local.get('settings');
    if (settings.enableBackgroundWatchlist !== false) {
      console.log('Prospectus: Running scheduled background watchlist check.');
      // Optional badge update
      await chrome.action.setBadgeText({ text: '•' });
      await chrome.action.setBadgeBackgroundColor({ color: '#cc785c' });
    }
  }
});
