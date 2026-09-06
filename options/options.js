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
  const analysisModeSelect = document.getElementById('analysis-mode-select');

  const licenseInput = document.getElementById('license-key-input');
  const btnActivate = document.getElementById('btn-activate-license');
  const licenseBadge = document.getElementById('license-badge');
  const licenseMsg = document.getElementById('license-msg');
  const licenseInputGroup = document.getElementById('license-input-group');
  const licenseActiveGroup = document.getElementById('license-active-group');
  const btnDeactivate = document.getElementById('btn-deactivate-license');
  const licenseSubtext = document.getElementById('license-subtext');

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
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', isRecommended: true },
      { id: 'claude-fable-5', label: 'Claude Fable 5' },
      { id: 'claude-opus-5', label: 'Claude Opus 5' },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
      { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
      { id: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
      { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
      { id: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5 (20251101)' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5 (20250929)' },
      { id: '__custom__', label: 'Custom / Enter model manually...' },
    ],
    openai: [
      { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
      { id: 'gpt-5.6', label: 'GPT-5.6' },
      { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
      { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
      { id: 'gpt-5.6-cyber', label: 'GPT-5.6 Cyber' },
      { id: 'gpt-5.5', label: 'GPT-5.5' },
      { id: 'gpt-5.5-pro', label: 'GPT-5.5 Pro' },
      { id: 'gpt-5.4', label: 'GPT-5.4' },
      { id: 'gpt-5.4-pro', label: 'GPT-5.4 Pro' },
      { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', isRecommended: true },
      { id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano' },
      { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' },
      { id: 'gpt-5.2', label: 'GPT-5.2' },
      { id: 'gpt-5.2-pro', label: 'GPT-5.2 Pro' },
      { id: 'gpt-5.1', label: 'GPT-5.1' },
      { id: 'gpt-5.1-chat-latest', label: 'GPT-5.1 Chat Latest' },
      { id: 'gpt-5', label: 'GPT-5' },
      { id: 'gpt-5-mini', label: 'GPT-5 Mini' },
      { id: 'gpt-5-nano', label: 'GPT-5 Nano' },
      { id: 'gpt-5-pro', label: 'GPT-5 Pro' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
      { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
      { id: '__custom__', label: 'Custom / Enter model manually...' },
    ],
    gemini: [
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', isRecommended: true },
      { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview' },
      { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
      { id: '__custom__', label: 'Custom / Enter model manually...' },
    ],
    openrouter: [
      { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5 (via OpenRouter)', isRecommended: true },
      { id: 'openai/gpt-5.6', label: 'GPT-5.6 (via OpenRouter)' },
      { id: 'google/gemini-3.8-flash', label: 'Gemini 3.8 Flash (via OpenRouter)' },
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

  function updateSelectDisplayLabels(selectElem) {
    if (!selectElem) return;
    Array.from(selectElem.options).forEach((opt, idx) => {
      if (idx === selectElem.selectedIndex) {
        // When selected in the closed dropdown, only show clean name without (Recommended)
        if (opt.dataset.clean) {
          opt.textContent = opt.dataset.clean;
        }
      } else {
        // Unselected items show their list label (with (Recommended) if applicable)
        if (opt.dataset.list) {
          opt.textContent = opt.dataset.list;
        }
      }
    });
  }

  function expandSelectListLabels(selectElem) {
    if (!selectElem) return;
    // When dropdown is opened, show full list labels so recommended items are tagged
    Array.from(selectElem.options).forEach((opt) => {
      if (opt.dataset.list) {
        opt.textContent = opt.dataset.list;
      }
    });
  }

  function populateModels(provider, selectedModel) {
    const list = PROVIDER_MODELS[provider] || PROVIDER_MODELS.anthropic;
    modelSelect.innerHTML = '';

    list.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      const cleanLabel = m.label.replace(/\s*\(Recommended\)/i, '').trim();
      const isRec = m.isRecommended || m.label.includes('(Recommended)');
      opt.dataset.clean = cleanLabel;
      opt.dataset.list = isRec ? `${cleanLabel} (Recommended)` : cleanLabel;
      // Initialize with clean text so closed select displays clean label
      opt.textContent = cleanLabel;
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

    updateSelectDisplayLabels(modelSelect);
  }

  function getActiveModelName() {
    let raw = '';
    if (modelSelect.value === '__custom__') {
      raw = modelCustomInput.value.trim() || 'claude-sonnet-5';
    } else {
      raw = modelSelect.value;
    }
    // Strictly strip any '(Recommended)' or '(recommended)' to ensure only clean model ID is returned
    return raw.replace(/\s*\([^)]*recommended[^)]*\)/gi, '').trim();
  }

  const searchProviderSelect = document.getElementById('search-provider-select');
  const searchApiKeyInput = document.getElementById('search-api-key-input');
  const chkDesktopNotif = document.getElementById('chk-desktop-notifications');
  const maxAutoTickersInput = document.getElementById('max-auto-tickers-input');
  const maxAutoTickersVal = document.getElementById('max-auto-tickers-val');

  // Load initial settings
  const settings = await storage.getSettings();
  const isKeyActive = LicenseService.isKeyValid(settings.licenseKey);
  if (!isKeyActive && (settings.licenseKey || settings.isLicensed)) {
    await storage.saveSettings({ licenseKey: '', isLicensed: false });
    settings.licenseKey = '';
    settings.isLicensed = false;
  }
  const usage = await storage.getUsageInfo();

  providerSelect.value = settings.aiProvider || 'anthropic';
  apiKeyInput.value = settings.apiKey || '';
  customEndpointInput.value = settings.customEndpoint || '';
  tempSlider.value = settings.temperature !== undefined ? settings.temperature : 0.2;
  tempVal.textContent = tempSlider.value;
  const modeCardFast = document.getElementById('mode-card-fast');
  const modeCardDeep = document.getElementById('mode-card-deep');

  function updateAnalysisModeUI(mode) {
    const activeMode = mode === 'deep' ? 'deep' : 'fast';
    if (analysisModeSelect) analysisModeSelect.value = activeMode;
    if (modeCardFast) modeCardFast.classList.toggle('active', activeMode === 'fast');
    if (modeCardDeep) modeCardDeep.classList.toggle('active', activeMode === 'deep');
  }

  if (modeCardFast) {
    modeCardFast.addEventListener('click', () => updateAnalysisModeUI('fast'));
  }
  if (modeCardDeep) {
    modeCardDeep.addEventListener('click', () => updateAnalysisModeUI('deep'));
  }
  if (analysisModeSelect) {
    analysisModeSelect.addEventListener('change', () => {
      updateAnalysisModeUI(analysisModeSelect.value);
    });
  }

  updateAnalysisModeUI(settings.analysisMode || 'fast');
  sidebarWidthSlider.value = settings.sidebarWidth || 440;
  sidebarWidthVal.textContent = sidebarWidthSlider.value;
  advHeightSlider.value = settings.deepResearchHeight || 240;
  advHeightVal.textContent = advHeightSlider.value;
  licenseInput.value = '';
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

  // Set up provider select dataset labels
  Array.from(providerSelect.options).forEach((opt) => {
    const isAnthropic = opt.value === 'anthropic';
    const clean = isAnthropic ? 'Anthropic' : opt.textContent.replace(/\s*\(Recommended\)/i, '').trim();
    opt.dataset.clean = clean;
    opt.dataset.list = isAnthropic ? 'Anthropic (Recommended)' : clean;
    opt.textContent = clean;
  });

  populateModels(providerSelect.value, settings.modelName);
  updateSelectDisplayLabels(providerSelect);
  updateProviderFields(providerSelect.value);
  updateLicenseUI(usage);

  // Provider change listener
  providerSelect.addEventListener('mousedown', () => expandSelectListLabels(providerSelect));
  providerSelect.addEventListener('focus', () => expandSelectListLabels(providerSelect));
  providerSelect.addEventListener('change', () => {
    updateSelectDisplayLabels(providerSelect);
    const val = providerSelect.value;
    updateProviderFields(val);
    populateModels(val);
  });
  providerSelect.addEventListener('blur', () => updateSelectDisplayLabels(providerSelect));

  // Model change listener
  modelSelect.addEventListener('mousedown', () => expandSelectListLabels(modelSelect));
  modelSelect.addEventListener('focus', () => expandSelectListLabels(modelSelect));
  modelSelect.addEventListener('change', () => {
    updateSelectDisplayLabels(modelSelect);
    if (modelSelect.value === '__custom__') {
      modelCustomInput.style.display = 'block';
      modelCustomInput.focus();
    } else {
      modelCustomInput.style.display = 'none';
    }
  });
  modelSelect.addEventListener('blur', () => updateSelectDisplayLabels(modelSelect));

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
    if (usageInfo && usageInfo.isLicensed) {
      licenseBadge.className = 'badge-status active';
      licenseBadge.textContent = '✓ Activated (Unlimited)';
      if (licenseSubtext) {
        licenseSubtext.textContent = 'License active with unlimited analyses.';
      }
      if (licenseInputGroup) {
        licenseInputGroup.style.display = 'none';
      }
      if (licenseActiveGroup) {
        licenseActiveGroup.style.display = 'flex';
      }
      licenseInput.value = '';
      licenseMsg.textContent = '';
    } else {
      licenseBadge.className = 'badge-status';
      licenseBadge.textContent = 'License Required';
      if (licenseSubtext) {
        licenseSubtext.textContent = 'Enter your purchase license key provided with your download.';
      }
      if (licenseInputGroup) {
        licenseInputGroup.style.display = 'flex';
      }
      if (licenseActiveGroup) {
        licenseActiveGroup.style.display = 'none';
      }
      licenseInput.value = '';
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
        // Automatically remove the activation key from the input and remove the input section
        licenseInput.value = '';
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

  licenseInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnActivate.click();
    }
  });

  // Deactivate license key
  if (btnDeactivate) {
    btnDeactivate.addEventListener('click', async () => {
      btnDeactivate.disabled = true;
      try {
        await licenseService.deactivate();
        const usageUpdated = await storage.getUsageInfo();
        updateLicenseUI(usageUpdated);
        licenseMsg.style.color = '#23654b';
        licenseMsg.textContent = 'License removed. You can enter a new activation key anytime.';
        setTimeout(() => {
          if (licenseInput) licenseInput.focus();
        }, 100);
      } catch (err) {
        // Deactivation error handled silently
      } finally {
        btnDeactivate.disabled = false;
      }
    });
  }

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
      analysisMode: analysisModeSelect ? analysisModeSelect.value : 'fast',
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
    const savePayload = {
      aiProvider: providerSelect.value,
      apiKey: apiKeyInput.value.trim(),
      modelName: finalModel,
      customEndpoint: customEndpointInput.value.trim(),
      temperature: parseFloat(tempSlider.value),
      analysisMode: analysisModeSelect ? analysisModeSelect.value : 'fast',
      enableBackgroundWatchlist: chkBgWatchlist.checked && (selectWatchlistSchedule ? parseInt(selectWatchlistSchedule.value, 10) > 0 : true),
      watchlistScheduleInterval: selectWatchlistSchedule ? parseInt(selectWatchlistSchedule.value, 10) : 1440,
      watchlistRefreshHours: selectWatchlistSchedule && parseInt(selectWatchlistSchedule.value, 10) > 0 ? parseInt(selectWatchlistSchedule.value, 10) / 60 : 0,
      enableDesktopNotifications: chkDesktopNotif ? chkDesktopNotif.checked : false,
      searchProvider: searchProviderSelect ? searchProviderSelect.value : 'brave',
      searchApiKey: searchApiKeyInput ? searchApiKeyInput.value.trim() : '',
      maxAutoDigestTickers: maxAutoTickersInput ? parseInt(maxAutoTickersInput.value, 10) : 10,
      sidebarWidth: parseInt(sidebarWidthSlider.value, 10),
      deepResearchHeight: parseInt(advHeightSlider.value, 10),
    };
    if (licenseInput && licenseInput.value.trim()) {
      savePayload.licenseKey = licenseInput.value.trim();
    }
    await storage.saveSettings(savePayload);

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
