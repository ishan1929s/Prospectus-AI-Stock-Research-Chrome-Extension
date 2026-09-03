/**
 * Prospectus - Action Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  const storage = window.ProspectusStorage || new StorageService();

  const titleEl = document.getElementById('active-page-title');
  const urlEl = document.getElementById('active-page-url');
  const statusDot = document.getElementById('popup-status-dot');
  const apiStatus = document.getElementById('popup-api-status');
  const licenseTag = document.getElementById('popup-license-tag');

  const btnToggle = document.getElementById('btn-toggle-panel');
  const btnAnalyze = document.getElementById('btn-analyze-page');
  const btnSettings = document.getElementById('popup-btn-settings');

  // Query active tab
  let activeTab = null;
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs[0];
    if (activeTab) {
      titleEl.textContent = activeTab.title || 'Web Page';
      try {
        const u = new URL(activeTab.url);
        urlEl.textContent = u.hostname + u.pathname;
      } catch (e) {
        urlEl.textContent = activeTab.url || '--';
      }
    }
  }

  // Load settings & status
  const settings = await storage.getSettings();
  const usage = await storage.getUsageInfo();

  if (!settings.apiKey && settings.aiProvider !== 'custom') {
    statusDot.className = 'status-dot warn';
    apiStatus.textContent = 'API key needed';
  } else {
    statusDot.className = 'status-dot';
    apiStatus.textContent = `${settings.aiProvider.toUpperCase()} · connected`;
  }

  if (usage.isLicensed) {
    licenseTag.textContent = 'Licensed · Unlimited';
    licenseTag.style.color = '#23654b';
  } else {
    licenseTag.textContent = 'License required';
    licenseTag.style.color = '#a9583e';
  }

  // Button actions
  btnToggle.addEventListener('click', async () => {
    if (activeTab && activeTab.id) {
      chrome.tabs.sendMessage(activeTab.id, { action: 'TOGGLE_PANEL' }).catch(async () => {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: [
            'services/storage-service.js',
            'services/license-service.js',
            'services/ai-service.js',
            'content/extractors.js',
            'content/diff-engine.js',
            'content/content.js',
          ],
        });
      });
    }
    window.close();
  });

  btnAnalyze.addEventListener('click', async () => {
    if (activeTab && activeTab.id) {
      chrome.tabs.sendMessage(activeTab.id, { action: 'TOGGLE_PANEL' }).catch(async () => {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: [
            'services/storage-service.js',
            'services/license-service.js',
            'services/ai-service.js',
            'content/extractors.js',
            'content/diff-engine.js',
            'content/content.js',
          ],
        });
      });
    }
    window.close();
  });

  btnSettings.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
    window.close();
  });
});
