/**
 * Prospectus - Options Page Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const storage = window.ProspectusStorage || new StorageService();
  const licenseService = window.ProspectusLicense || new LicenseService(storage);
  const aiService = window.ProspectusAI || new AIService(storage);

  // Form Elements
  const providerSelect = document.getElementById('ai-provider-select');
  const apiKeyInput = document.getElementById('api-key-input');
  const modelNameInput = document.getElementById('model-name-input');
  const groupCustomEndpoint = document.getElementById('group-custom-endpoint');
  const customEndpointInput = document.getElementById('custom-endpoint-input');
  const tempSlider = document.getElementById('temp-slider');
  const tempVal = document.getElementById('temp-val');

  const licenseInput = document.getElementById('license-key-input');
  const btnActivate = document.getElementById('btn-activate-license');
  const licenseBadge = document.getElementById('license-badge');
  const licenseMsg = document.getElementById('license-msg');

  const chkBgWatchlist = document.getElementById('chk-background-watchlist');
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

  // Load current settings
  const settings = await storage.getSettings();
  const usage = await storage.getUsageInfo();

  // Populate UI
  providerSelect.value = settings.aiProvider || 'openai';
  apiKeyInput.value = settings.apiKey || '';
  modelNameInput.value = settings.modelName || 'gpt-4o-mini';
  customEndpointInput.value = settings.customEndpoint || '';
  tempSlider.value = settings.temperature !== undefined ? settings.temperature : 0.2;
  tempVal.textContent = tempSlider.value;
  sidebarWidthSlider.value = settings.sidebarWidth || 440;
  sidebarWidthVal.textContent = sidebarWidthSlider.value;
  advHeightSlider.value = settings.deepResearchHeight || 220;
  advHeightVal.textContent = advHeightSlider.value;
  licenseInput.value = settings.licenseKey || '';
  chkBgWatchlist.checked = settings.enableBackgroundWatchlist !== false;

  updateProviderFields(providerSelect.value);
  updateLicenseUI(usage);

  // Provider change listener
  providerSelect.addEventListener('change', () => {
    const val = providerSelect.value;
    updateProviderFields(val);
    // Suggest default model
    if (val === 'openai') modelNameInput.value = 'gpt-4o-mini';
    else if (val === 'anthropic') modelNameInput.value = 'claude-3-5-haiku-20241022';
    else if (val === 'gemini') modelNameInput.value = 'gemini-2.0-flash';
    else if (val === 'openrouter') modelNameInput.value = 'meta-llama/llama-3.3-70b-instruct';
    else if (val === 'custom') modelNameInput.value = 'llama3';
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
    await storage.saveSettings({
      aiProvider: providerSelect.value,
      apiKey: apiKeyInput.value.trim(),
      modelName: modelNameInput.value.trim(),
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
    await storage.saveSettings({
      aiProvider: providerSelect.value,
      apiKey: apiKeyInput.value.trim(),
      modelName: modelNameInput.value.trim(),
      customEndpoint: customEndpointInput.value.trim(),
      temperature: parseFloat(tempSlider.value),
      licenseKey: licenseInput.value.trim(),
      enableBackgroundWatchlist: chkBgWatchlist.checked,
      sidebarWidth: parseInt(sidebarWidthSlider.value, 10),
      deepResearchHeight: parseInt(advHeightSlider.value, 10),
    });

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
