/**
 * Prospectus - Options Page Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const storage = window.ProspectusStorage || new StorageService();
  const licenseService = window.ProspectusLicense || new LicenseService(storage);
  const aiService = window.ProspectusAI || new AIService(storage);

  // Form Elements
  const providerSelect = document.getElementById('ai-provider-select');
  const modelSelect = document.getElementById('model-select');
  const modelCustomInput = document.getElementById('model-name-custom-input');
  const apiKeyInput = document.getElementById('api-key-input');
  const groupCustomEndpoint = document.getElementById('group-custom-endpoint');
  const customEndpointInput = document.getElementById('custom-endpoint-input');
  const tempSlider = document.getElementById('temp-slider');
  const tempVal = document.getElementById('temp-val');

  const licenseInput = document.getElementById('license-key-input');
  const btnActivate = document.getElementById('btn-activate-license');
  const licenseBadge = document.getElementById('license-badge');
  const licenseMsg = document.getElementById('license-msg');

  const chkBgWatchlist = document.getElementById('chk-background-watchlist');
  const selectWatchlistSchedule = document.getElementById('select-options-watchlist-schedule');
  const sidebarWidthSlider = document.getElementById('sidebar-width-slider');
  const sidebarWidthVal = document.getElementById('sidebar-width-val');
  const advHeightSlider = document.getElementById('adv-height-slider');
  const advHeightVal = document.getElementById('adv-height-val');

  const btnTest = document.getElementById('btn-test-connection');
  const testStatus = document.getElementById('test-status-msg');
  const btnSave = document.getElementById('btn-save-settings');
  const saveFeedback = document.getElementById('save-feedback');

  const btnExportAll = document.getElementById('btn-export-all-data');
  const btnClearSnapshots = document.getElementById('btn-clear-snapshots');
  const dataActionMsg = document.getElementById('data-action-msg');

  // Official models dictionary per provider
  const PROVIDER_MODELS = {
    anthropic: [
      { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet (Latest & Recommended)' },
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast & Lightweight)' },
      { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
      { id: '__custom__', label: 'Custom / Enter model manually...' },
    ],
    openai: [
      { id: 'gpt-4o', label: 'GPT-4o (Flagship Omni)' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & Affordable)' },
      { id: 'o3-mini', label: 'o3-mini (High-Reasoning)' },
      { id: 'o1', label: 'o1 (Reasoning)' },
      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { id: '__custom__', label: 'Custom / Enter model manually...' },
    ],
    gemini: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Recommended)' },
      { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite (Ultra-fast)' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Deep Context)' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
      { id: '__custom__', label: 'Custom / Enter model manually...' },
    ],
    openrouter: [
      { id: 'anthropic/claude-3.7-sonnet', label: 'Claude 3.7 Sonnet (via OpenRouter)' },
      { id: 'openai/gpt-4o', label: 'GPT-4o (via OpenRouter)' },
      { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash (via OpenRouter)' },
      { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct' },
      { id: '__custom__', label: 'Custom / Enter model manually...' },
    ],
    custom: [
      { id: 'llama3', label: 'Llama 3 (Local)' },
      { id: 'mistral', label: 'Mistral (Local)' },
      { id: 'deepseek-r1', label: 'DeepSeek R1 (Local)' },
      { id: 'qwen2.5', label: 'Qwen 2.5 (Local)' },
      { id: '__custom__', label: 'Custom / Enter model manually...' },
    ],
  };

  function populateModels(provider, selectedModel) {
    const list = PROVIDER_MODELS[provider] || PROVIDER_MODELS.anthropic;
    modelSelect.innerHTML = '';

    list.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label;
      modelSelect.appendChild(opt);
    });

    const isKnown = list.some((m) => m.id === selectedModel && m.id !== '__custom__');
    if (selectedModel && isKnown) {
      modelSelect.value = selectedModel;
      modelCustomInput.style.display = 'none';
    } else if (selectedModel && selectedModel !== list[0].id) {
      modelSelect.value = '__custom__';
      modelCustomInput.value = selectedModel;
      modelCustomInput.style.display = 'block';
    } else {
      modelSelect.value = list[0].id;
      modelCustomInput.style.display = 'none';
    }
  }

  function getActiveModelName() {
    if (modelSelect.value === '__custom__') {
      return modelCustomInput.value.trim() || 'default-model';
    }
    return modelSelect.value;
  }

  const searchProviderSelect = document.getElementById('search-provider-select');
  const searchApiKeyInput = document.getElementById('search-api-key-input');
  const chkDesktopNotif = document.getElementById('chk-desktop-notifications');
  const maxAutoTickersInput = document.getElementById('max-auto-tickers-input');
  const maxAutoTickersVal = document.getElementById('max-auto-tickers-val');

  // Load initial settings
  const settings = await storage.getSettings();
  const usage = await storage.getUsageInfo();

  providerSelect.value = settings.aiProvider || 'anthropic';
  apiKeyInput.value = settings.apiKey || '';
  customEndpointInput.value = settings.customEndpoint || '';
  tempSlider.value = settings.temperature !== undefined ? settings.temperature : 0.2;
  tempVal.textContent = tempSlider.value;
  sidebarWidthSlider.value = settings.sidebarWidth || 440;
  sidebarWidthVal.textContent = sidebarWidthSlider.value;
  advHeightSlider.value = settings.deepResearchHeight || 240;
  advHeightVal.textContent = advHeightSlider.value;
  licenseInput.value = settings.licenseKey || '';
  chkBgWatchlist.checked = settings.enableBackgroundWatchlist !== false;
  if (selectWatchlistSchedule) {
    const sched = settings.watchlistScheduleInterval !== undefined
      ? settings.watchlistScheduleInterval
      : (settings.enableBackgroundWatchlist !== false ? 1440 : 0);
    selectWatchlistSchedule.value = String(sched);
  }
  if (chkDesktopNotif) chkDesktopNotif.checked = !!settings.enableDesktopNotifications;
  if (searchProviderSelect) searchProviderSelect.value = settings.searchProvider || 'brave';
  if (searchApiKeyInput) searchApiKeyInput.value = settings.searchApiKey || '';
  if (maxAutoTickersInput) {
    maxAutoTickersInput.value = settings.maxAutoDigestTickers || 10;
    maxAutoTickersVal.textContent = maxAutoTickersInput.value;
    maxAutoTickersInput.addEventListener('input', () => {
      maxAutoTickersVal.textContent = maxAutoTickersInput.value;
    });
  }

  populateModels(providerSelect.value, settings.modelName);
  updateProviderFields(providerSelect.value);
  updateLicenseUI(usage);

  // Provider change listener
  providerSelect.addEventListener('change', () => {
    const val = providerSelect.value;
    updateProviderFields(val);
    populateModels(val);
  });

  // Model change listener
  modelSelect.addEventListener('change', () => {
    if (modelSelect.value === '__custom__') {
      modelCustomInput.style.display = 'block';
      modelCustomInput.focus();
    } else {
      modelCustomInput.style.display = 'none';
    }
  });

  tempSlider.addEventListener('input', () => {
    tempVal.textContent = tempSlider.value;
  });

  sidebarWidthSlider.addEventListener('input', () => {
    sidebarWidthVal.textContent = sidebarWidthSlider.value;
  });

  advHeightSlider.addEventListener('input', () => {
    advHeightVal.textContent = advHeightSlider.value;
  });

  function updateProviderFields(val) {
    if (val === 'custom') {
      groupCustomEndpoint.style.display = 'flex';
    } else {
      groupCustomEndpoint.style.display = 'none';
    }
  }

  function updateLicenseUI(usageInfo) {
    if (usageInfo.isLicensed) {
      licenseBadge.className = 'badge-status active';
      licenseBadge.textContent = '✓ Activated (Unlimited)';
      licenseMsg.style.color = '#23654b';
      licenseMsg.textContent = 'Your extension is activated with unlimited analyses.';
    } else {
      licenseBadge.className = 'badge-status';
      licenseBadge.textContent = 'License Required';
      licenseMsg.style.color = '#8e8b82';
      licenseMsg.textContent = 'Enter the license key provided with your download to activate.';
    }
  }

  // Activate license key
  btnActivate.addEventListener('click', async () => {
    const key = licenseInput.value.trim();
    if (!key) {
      licenseMsg.style.color = '#c64545';
      licenseMsg.textContent = 'Please enter a license key.';
      return;
    }

    btnActivate.disabled = true;
    licenseMsg.textContent = 'Verifying key...';
    try {
      const res = await licenseService.activate(key);
      if (res.valid) {
        const usageUpdated = await storage.getUsageInfo();
        updateLicenseUI(usageUpdated);
      } else {
        licenseMsg.style.color = '#c64545';
        licenseMsg.textContent = res.message;
      }
    } catch (err) {
      licenseMsg.style.color = '#c64545';
      licenseMsg.textContent = err.message;
    } finally {
      btnActivate.disabled = false;
    }
  });

  // Test Connection
  btnTest.addEventListener('click', async () => {
    testStatus.textContent = 'Testing connection...';
    testStatus.style.color = '#6c6a64';
    btnTest.disabled = true;

    // Temporarily save to test with current form values
    const modelToTest = getActiveModelName();
    await storage.saveSettings({
      aiProvider: providerSelect.value,
      apiKey: apiKeyInput.value.trim(),
      modelName: modelToTest,
      customEndpoint: customEndpointInput.value.trim(),
      temperature: parseFloat(tempSlider.value),
    });

    try {
      const response = await aiService.callLLM({
        userPrompt: 'Respond with exactly the word "CONNECTED".',
      });
      if (response && response.toUpperCase().includes('CONNECTED')) {
        testStatus.textContent = '✓ Connection successful!';
        testStatus.style.color = '#23654b';
      } else {
        testStatus.textContent = `Response received: "${response.slice(0, 30)}..."`;
        testStatus.style.color = '#23654b';
      }
    } catch (err) {
      testStatus.textContent = `✕ Error: ${err.message}`;
      testStatus.style.color = '#c64545';
    } finally {
      btnTest.disabled = false;
    }
  });

  // Save Settings
  btnSave.addEventListener('click', async () => {
    btnSave.disabled = true;
    const finalModel = getActiveModelName();
    await storage.saveSettings({
      aiProvider: providerSelect.value,
      apiKey: apiKeyInput.value.trim(),
      modelName: finalModel,
      customEndpoint: customEndpointInput.value.trim(),
      temperature: parseFloat(tempSlider.value),
      licenseKey: licenseInput.value.trim(),
      enableBackgroundWatchlist: chkBgWatchlist.checked && (selectWatchlistSchedule ? parseInt(selectWatchlistSchedule.value, 10) > 0 : true),
      watchlistScheduleInterval: selectWatchlistSchedule ? parseInt(selectWatchlistSchedule.value, 10) : 1440,
      watchlistRefreshHours: selectWatchlistSchedule && parseInt(selectWatchlistSchedule.value, 10) > 0 ? parseInt(selectWatchlistSchedule.value, 10) / 60 : 0,
      enableDesktopNotifications: chkDesktopNotif ? chkDesktopNotif.checked : false,
      searchProvider: searchProviderSelect ? searchProviderSelect.value : 'brave',
      searchApiKey: searchApiKeyInput ? searchApiKeyInput.value.trim() : '',
      maxAutoDigestTickers: maxAutoTickersInput ? parseInt(maxAutoTickersInput.value, 10) : 10,
      sidebarWidth: parseInt(sidebarWidthSlider.value, 10),
      deepResearchHeight: parseInt(advHeightSlider.value, 10),
    });

    if (selectWatchlistSchedule && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'UPDATE_WATCHLIST_ALARM',
        intervalMinutes: parseInt(selectWatchlistSchedule.value, 10),
      }).catch(() => {});
    }

    saveFeedback.textContent = '✓ Settings saved successfully.';
    setTimeout(() => {
      saveFeedback.textContent = '';
      btnSave.disabled = false;
    }, 2000);
  });

  // Data management
  btnExportAll.addEventListener('click', async () => {
    const notes = await storage.getNotebookEntries();
    const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prospectus_notes_backup_${Date.now()}.json`;
    a.click();
    dataActionMsg.textContent = '✓ All notebook entries exported.';
  });

  btnClearSnapshots.addEventListener('click', async () => {
    if (confirm('Clear all locally cached filing snapshots? Your notes will remain intact.')) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const all = await new Promise((r) => chrome.storage.local.get(null, r));
        const keysToRemove = Object.keys(all).filter((k) => k.startsWith('snapshot_') || k.startsWith('snapshots_index_'));
        await new Promise((r) => chrome.storage.local.remove(keysToRemove, r));
      }
      dataActionMsg.textContent = '✓ Filing snapshot cache cleared.';
    }
  });
});
