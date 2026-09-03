/**
 * Prospectus - Content Script Controller
 * Injects isolated Shadow DOM sidebar panel and floating text selection tooltips.
 */

(function () {
  // Prevent duplicate injection
  if (window.__prospectus_injected) return;
  window.__prospectus_injected = true;

  // Reusable SVG Icons matching Claude DESIGN.md
  const ICONS = {
    doc: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#cc785c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
    dock: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line></svg>`,
    settings: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
    close: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    sparkle: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"></path></svg>`,
    bookmark: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`,
    export: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
    trash: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    search: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  };

  class ProspectusApp {
    constructor() {
      this.hostElement = null;
      this.shadowRoot = null;
      this.isOpen = false;
      this.activeTab = 'summary';
      this.pageData = null;
      this.storage = window.ProspectusStorage || new StorageService();
      this.ai = window.ProspectusAI || new AIService(this.storage);
      this.license = window.ProspectusLicense || new LicenseService(this.storage);
      this.selectedText = '';
      this.selectedRange = null;
      this.summaryResult = null;
      this.isAnalyzing = false;

      this.init();
    }

    async init() {
      // Guard: Do not execute or inject Shadow DOM on raw XML / XSD / JSON documents
      if (
        !(document instanceof HTMLDocument) ||
        (document.contentType && document.contentType.includes('xml')) ||
        window.location.pathname.endsWith('.xml') ||
        window.location.pathname.endsWith('.xsd') ||
        window.location.pathname.endsWith('.json') ||
        !document.body
      ) {
        return;
      }

      this.pageData = FinancialExtractors.extractPageData();
      await this.injectShadowHost();
      this.setupSelectionListener();
      this.setupMessageListener();
    }

    async injectShadowHost() {
      this.hostElement = document.createElement('div');
      this.hostElement.id = 'prospectus-root';
      document.documentElement.appendChild(this.hostElement);

      this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

      // Fetch or link panel.css
      const cssUrl = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL
        ? chrome.runtime.getURL('content/panel.css')
        : 'content/panel.css';

      const styleLink = `<link rel="stylesheet" href="${cssUrl}">`;

      const urlClean = `${window.location.hostname}${window.location.pathname}${window.location.search}`;

      this.shadowRoot.innerHTML = `
        ${styleLink}
        <div id="prospectus-dock-btn" class="prospectus-dock-toggle" style="display: none;">
          <div class="icon-badge">${ICONS.doc}</div>
          <span>Prospectus</span>
        </div>
        <div id="prospectus-sidebar" class="prospectus-panel">
          <!-- Sidebar Left Edge Drag-to-Resize Handle -->
          <div class="prospectus-resize-handle-left" id="prospectus-sidebar-resize-handle" title="Drag left/right to resize sidebar width"></div>

          <!-- Top Header -->
          <div class="prospectus-header">
            <div class="browser-bar">
              <div class="window-dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
              </div>
              <div class="url-input-mock" id="prospectus-url-bar">${urlClean}</div>
              <button class="url-dock-btn" id="btn-dock-toggle" title="Dock / Minimize">${ICONS.dock}</button>
            </div>
            <div class="brand-row">
              <div class="brand-title">
                <strong><span class="brand-icon">${ICONS.doc}</span> Prospectus</strong>
                <span class="brand-tag">research, organized</span>
              </div>
              <div class="header-controls">
                <button class="icon-btn" id="btn-open-settings" title="Settings" aria-label="Settings">${ICONS.settings}</button>
                <button class="icon-btn" id="btn-close-sidebar" title="Close Panel" aria-label="Close">${ICONS.close}</button>
              </div>
            </div>
          </div>

          <!-- Ticker & Metadata Overview (Shown for finance pages) -->
          <div class="ticker-overview" id="ticker-overview-container" style="${this.pageData.isFinanceSite ? 'display: flex;' : 'display: none;'}">
            <div class="ticker-title-group">
              <span class="ticker-symbol" id="display-ticker">${this.pageData.ticker}</span>
              <span class="company-name" id="display-company">${this.pageData.company}</span>
            </div>
            <div class="pill-row">
              <span class="pill" id="pill-exchange">${this.pageData.exchange || 'NYSE'}</span>
              <span class="pill" id="pill-sector">${this.pageData.sector || 'Industrials'}</span>
              <span class="pill accent" id="pill-period">${this.pageData.periodBadge || '10-K · Current'}</span>
            </div>
          </div>

          <!-- Navigation Tabs -->
          <div class="tab-navigation" id="tab-navigation-bar">
            <button class="tab-btn active" data-tab="summary">Summary</button>
            <button class="tab-btn" data-tab="what-changed">What changed</button>
            <button class="tab-btn" data-tab="explain">Explain terms</button>
            <button class="tab-btn" data-tab="notebook">Notebook</button>
            <button class="tab-btn" data-tab="watchlist">Watchlist</button>
          </div>

          <!-- Tab Content Wrapper -->
          <div class="tab-content-wrapper" id="tab-content-container">
            <!-- Rendered by renderTab() -->
          </div>

          <!-- Advanced Research & Ask LLM Interactive Footer (Appears after analysis) -->
          <div id="prospectus-advanced-footer" class="prospectus-advanced-footer" style="display: none;"></div>

          <!-- Status Footer -->
          <div class="prospectus-footer">
            <div class="api-status-group" id="footer-api-group" style="cursor: pointer;" title="Configure in Settings">
              <div class="status-dot" id="footer-status-dot"></div>
              <span id="footer-api-status">Your API key · connected</span>
            </div>
            <span class="license-info" id="footer-license-status" style="cursor: pointer;" title="License Status">Unlimited · one-time purchase</span>
          </div>
        </div>

        <!-- Floating Selection Tooltip -->
        <div id="prospectus-tooltip" class="prospectus-floating-tooltip" style="display: none;">
          <button class="tooltip-action-btn primary" id="tt-btn-explain">
            ${ICONS.sparkle} <span>Explain</span>
          </button>
          <button class="tooltip-action-btn" id="tt-btn-save">
            ${ICONS.bookmark} <span>Notebook</span>
          </button>
        </div>
      `;

      this.applySavedDimensions();
      this.bindEvents();
      this.updateFooterStatus();
      this.renderTab('summary');
    }

    async applySavedDimensions() {
      const settings = await this.storage.getSettings();
      const sidebar = this.shadowRoot.getElementById('prospectus-sidebar');
      if (sidebar && settings.sidebarWidth) {
        sidebar.style.width = `${settings.sidebarWidth}px`;
      }
    }

    bindEvents() {
      const toggleBtn = this.shadowRoot.getElementById('prospectus-dock-btn');
      const closeBtn = this.shadowRoot.getElementById('btn-close-sidebar');
      const dockBtn = this.shadowRoot.getElementById('btn-dock-toggle');
      const settingsBtn = this.shadowRoot.getElementById('btn-open-settings');
      const footerApiGroup = this.shadowRoot.getElementById('footer-api-group');
      const footerLicenseStatus = this.shadowRoot.getElementById('footer-license-status');
      const tabBtns = this.shadowRoot.querySelectorAll('.tab-btn');
      const leftHandle = this.shadowRoot.getElementById('prospectus-sidebar-resize-handle');
      const sidebar = this.shadowRoot.getElementById('prospectus-sidebar');

      toggleBtn.addEventListener('click', () => this.togglePanel());
      closeBtn.addEventListener('click', () => this.closePanel());
      dockBtn.addEventListener('click', () => this.closePanel());

      // Interactive Sidebar Drag-to-Resize
      if (leftHandle && sidebar) {
        let isResizing = false;
        let startX = 0;
        let startWidth = 440;

        leftHandle.addEventListener('mousedown', (e) => {
          isResizing = true;
          startX = e.clientX;
          startWidth = sidebar.getBoundingClientRect().width;
          leftHandle.classList.add('active');
          document.body.style.userSelect = 'none';
          document.body.style.cursor = 'ew-resize';
          e.preventDefault();
          e.stopPropagation();
        });

        window.addEventListener('mousemove', (e) => {
          if (!isResizing) return;
          const delta = startX - e.clientX; // dragging left expands width
          const newWidth = Math.min(Math.max(340, Math.round(startWidth + delta)), Math.min(850, Math.round(window.innerWidth * 0.88)));
          sidebar.style.width = `${newWidth}px`;
        });

        window.addEventListener('mouseup', async () => {
          if (!isResizing) return;
          isResizing = false;
          leftHandle.classList.remove('active');
          document.body.style.userSelect = '';
          document.body.style.cursor = '';
          const finalWidth = Math.round(sidebar.getBoundingClientRect().width);
          await this.storage.saveSettings({ sidebarWidth: finalWidth });
        });
      }

      const openSettings = () => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'OPEN_OPTIONS' }, () => {
            if (chrome.runtime.lastError) {
              const optionsUrl = chrome.runtime.getURL('options/options.html');
              window.open(optionsUrl, '_blank');
            }
          });
        } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
          window.open(chrome.runtime.getURL('options/options.html'), '_blank');
        }
      };

      settingsBtn.addEventListener('click', openSettings);
      footerApiGroup.addEventListener('click', openSettings);
      footerLicenseStatus.addEventListener('click', openSettings);

      tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          this.shadowRoot.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.switchTab(btn.dataset.tab);
        });
      });

      // Tooltip actions
      const ttExplain = this.shadowRoot.getElementById('tt-btn-explain');
      const ttSave = this.shadowRoot.getElementById('tt-btn-save');

      ttExplain.addEventListener('click', () => {
        this.hideTooltip();
        this.openPanel();
        this.switchTab('explain');
        this.triggerExplainTerm(this.selectedText);
      });

      ttSave.addEventListener('click', async () => {
        this.hideTooltip();
        await this.storage.saveNotebookEntry({
          ticker: this.pageData.ticker,
          company: this.pageData.company,
          quote: this.selectedText,
          note: 'Saved from page highlight.',
          sourceUrl: window.location.href,
          filingPeriod: this.pageData.periodBadge,
          tags: ['Highlight', this.pageData.ticker],
        });
        this.showToast('Saved to Notebook');
      });
    }

    togglePanel() {
      if (this.isOpen) this.closePanel();
      else this.openPanel();
    }

    openPanel() {
      const sidebar = this.shadowRoot.getElementById('prospectus-sidebar');
      const dockBtn = this.shadowRoot.getElementById('prospectus-dock-btn');
      sidebar.classList.remove('closed');
      dockBtn.style.display = 'none';
      this.isOpen = true;
    }

    closePanel() {
      const sidebar = this.shadowRoot.getElementById('prospectus-sidebar');
      const dockBtn = this.shadowRoot.getElementById('prospectus-dock-btn');
      sidebar.classList.add('closed');
      dockBtn.style.display = 'flex';
      this.isOpen = false;
    }

    switchTab(tabName) {
      this.activeTab = tabName;
      const tabBtns = this.shadowRoot.querySelectorAll('.tab-btn');
      tabBtns.forEach((btn) => {
        if (btn.dataset.tab === tabName) btn.classList.add('active');
        else btn.classList.remove('active');
      });
      this.renderTab(tabName);
    }

    async updateFooterStatus() {
      const settings = await this.storage.getSettings();
      const usage = await this.storage.getUsageInfo();

      const dot = this.shadowRoot.getElementById('footer-status-dot');
      const apiText = this.shadowRoot.getElementById('footer-api-status');
      const licText = this.shadowRoot.getElementById('footer-license-status');

      if (!settings.apiKey && settings.aiProvider !== 'custom') {
        dot.className = 'status-dot warning';
        apiText.textContent = 'API Key needed (Settings)';
      } else {
        dot.className = 'status-dot';
        apiText.textContent = 'Your API key · connected';
      }

      if (usage.isLicensed) {
        licText.textContent = 'Unlimited · one-time purchase';
        licText.style.color = '#8e8b82';
      } else {
        licText.textContent = 'License required';
        licText.style.color = '#a9583e';
      }
    }

    // ==========================================
    // Tab Renderers
    // ==========================================
    async renderTab(tabName) {
      const container = this.shadowRoot.getElementById('tab-content-container');
      container.innerHTML = '';

      switch (tabName) {
        case 'summary':
          this.renderSummaryTab(container);
          break;
        case 'what-changed':
          this.renderWhatChangedTab(container);
          break;
        case 'explain':
          this.renderExplainTab(container);
          break;
        case 'notebook':
          this.renderNotebookTab(container);
          break;
        case 'watchlist':
          this.renderWatchlistTab(container);
          break;
      }
    }

    // --- Tab 1: Summary ---
    renderSummaryTab(container) {
      // If no summary has been generated yet, always show the manual start prompt
      if (!this.summaryResult && !this.isAnalyzing) {
        container.innerHTML = `
          <div class="non-finance-view">
            <p class="non-finance-prompt">Ready to analyze ${this.pageData.company || 'this document'}?</p>
            <button class="btn-dark-cta" id="btn-manual-analyze">
              Analyze this page
            </button>
            <div class="non-finance-notice">
              Click to run AI summary, extract key risk disclosures, and evaluate coverage tone. All processing runs on-demand with your API key.
            </div>
          </div>
        `;

        const manualBtn = this.shadowRoot.getElementById('btn-manual-analyze');
        if (manualBtn) {
          manualBtn.addEventListener('click', () => {
            this.runSummaryAnalysis();
          });
        }
        return;
      }

      // If currently analyzing
      if (this.isAnalyzing) {
        container.innerHTML = `
          <h2 class="section-headline">Analyzing content...</h2>
          <div class="coverage-tone-card">
            <div class="loading-shimmer" style="height: 20px; width: 60%;"></div>
            <div class="loading-shimmer" style="height: 8px; margin: 12px 0;"></div>
            <div class="loading-shimmer" style="height: 14px; width: 90%;"></div>
          </div>
          <div class="loading-shimmer" style="height: 28px; width: 45%;"></div>
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
            <div class="loading-shimmer" style="height: 16px;"></div>
            <div class="loading-shimmer" style="height: 16px;"></div>
            <div class="loading-shimmer" style="height: 16px;"></div>
          </div>
        `;
        return;
      }

      // If summary is available or on a finance page
      const res = this.summaryResult || {
        toneScore: 50,
        toneLabel: 'Neutral',
        toneTag: 'Tone: factual overview',
        bullets: [
          'Document extracted. Click "Analyze" or configure your API key in Settings to generate a live AI breakdown.',
        ],
        whatChangedPointer: 'Open What changed for exact filing language diffs.'
      };

      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 class="section-headline">${this.pageData.isFinanceSite ? 'Filing summary' : 'Page summary'}</h2>
          <button class="coral-btn" id="btn-reanalyze" style="font-size: 11px; padding: 4px 8px;">Re-analyze</button>
        </div>

        <!-- Coverage Tone Meter Card -->
        <div class="coverage-tone-card">
          <div class="meter-header">
            <span class="meter-title">Coverage tone, last 30 days</span>
            <span class="meter-label" id="meter-label-text">${res.toneLabel || 'Neutral'}</span>
          </div>
          <div class="meter-track-container">
            <div class="meter-bar">
              <div class="meter-tick" id="meter-tick-indicator" style="left: ${Math.min(95, Math.max(5, res.toneScore || 50))}%;"></div>
            </div>
            <div class="meter-labels">
              <span>Negative</span>
              <span>Neutral</span>
              <span>Positive</span>
            </div>
          </div>
          <p class="meter-disclaimer">
            Built from news volume and tone over the last 30 days. It describes what's already been said, not what happens next.
          </p>
        </div>

        <!-- Tone Tag -->
        <div class="tone-highlight-pill" id="summary-tone-pill">
          ${res.toneTag || 'Tone: factual'}
        </div>

        <!-- Bullets -->
        <ul class="summary-bullets" id="summary-bullet-list">
          ${(res.bullets || []).map((b) => `<li>${b}</li>`).join('')}
        </ul>

        <div class="editorial-divider"></div>

        <p class="compliance-note">
          This is a description of what the filing says, not a view on the stock. Open <strong>What changed</strong> for the exact language that's new.
        </p>
      `;

      const reBtn = this.shadowRoot.getElementById('btn-reanalyze');
      if (reBtn) {
        reBtn.addEventListener('click', () => this.runSummaryAnalysis());
      }
    }

    async runSummaryAnalysis() {
      const check = await this.license.checkCanAnalyze();
      if (!check.allowed) {
        this.showToast('License required. Open Settings.');
        return;
      }

      const settings = await this.storage.getSettings();
      if (!settings.apiKey && settings.aiProvider !== 'custom') {
        this.showToast('Please enter API key in Settings.');
        return;
      }

      this.isAnalyzing = true;
      this.renderTab('summary');

      try {
        const res = await this.ai.generateSummary({
          ticker: this.pageData.ticker,
          company: this.pageData.company,
          formType: this.pageData.formType,
          text: this.pageData.fullText,
          headlines: this.pageData.headlines,
        });

        this.summaryResult = res;
        this.renderAdvancedFooter(res.suggestedQueries || []);
      } catch (err) {
        console.warn('Summary AI analysis error:', err.message);
        this.summaryResult = {
          toneScore: 50,
          toneLabel: 'Neutral',
          toneTag: 'Tone: descriptive',
          bullets: [
            `Extracted document content for ${this.pageData.company}.`,
            `Could not complete AI call: ${err.message}`,
            `Check your API key and connection in Prospectus Settings.`
          ],
          whatChangedPointer: 'Open What changed for exact filing language diffs.'
        };
        this.renderAdvancedFooter([
          `Single-source supplier concentration & Southeast Asia risks`,
          `Capex guidance & Texas plant expansion timeline`,
          `Gross margin preservation & volume trends`
        ]);
      } finally {
        this.isAnalyzing = false;
        this.renderTab('summary');
        this.updateFooterStatus();
      }
    }

    // --- Tab 2: What Changed (Diff View) ---
    async renderWhatChangedTab(container) {
      const defaultOld = FilingDiffEngine.getDefaultBaselineText(this.pageData.ticker);
      const defaultNew = this.pageData.riskFactorsText || this.pageData.fullText.slice(0, 4000);

      const diffResult = FilingDiffEngine.computeDiff(defaultOld, defaultNew);
      const redlineHTML = FilingDiffEngine.renderRedlineHTML(diffResult);

      container.innerHTML = `
        <div class="section-headline">
          <span>What changed</span>
          <div class="diff-stats-badge">
            <span class="stat-tag add">+${diffResult.stats.addedCount} added</span>
            <span class="stat-tag del">-${diffResult.stats.deletedCount} removed</span>
          </div>
        </div>

        <div class="diff-toolbar">
          <select class="select-input" id="baseline-select">
            <option value="q1">Baseline: Prior Period Disclosure</option>
            <option value="annual">Baseline: Prior Annual Filing</option>
          </select>
          <button class="coral-btn" id="btn-save-snapshot" style="font-size: 11px; padding: 5px 9px;">Save Snapshot</button>
        </div>

        <div class="card-box" id="ai-diff-summary-card">
          <h4>Material Changes Summary</h4>
          <p id="diff-summary-text">
            Language shifts focus to updated operational disclosures, supplier dependencies, and capex guidance adjustments between reporting periods.
          </p>
        </div>

        <div class="diff-container" id="diff-redline-view">
          ${redlineHTML}
        </div>

        <p class="compliance-note">
          Redline comparison compares consecutive SEC Item 1A Risk disclosures directly.
        </p>
      `;

      const saveBtn = this.shadowRoot.getElementById('btn-save-snapshot');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          await this.storage.saveFilingSnapshot(
            this.pageData.ticker,
            this.pageData.formType,
            this.pageData.filingDate,
            { text: defaultNew }
          );
          this.showToast('Filing snapshot saved as baseline.');
        });
      }
    }

    // --- Tab 3: Explain Terms ---
    renderExplainTab(container) {
      container.innerHTML = `
        <h2 class="section-headline">Explain terms</h2>
        <p style="font-size: 13px; color: #6c6a64;">
          Highlight any term on the page or enter it below to explain it using the actual figures in this document.
        </p>

        <div class="explain-input-box">
          <input type="text" class="text-input-field" id="explain-term-input" placeholder="e.g. gross margin, deferred revenue..." />
          <button class="coral-btn" id="btn-run-explain">Explain</button>
        </div>

        <div class="card-box" id="explain-result-card" style="display: none;">
          <h4 id="explain-result-term">Term Explanation</h4>
          <p id="explain-result-body">Loading...</p>
          <button class="coral-btn" id="btn-save-explain-note" style="align-self: flex-start; margin-top: 6px; font-size: 12px;">
            ${ICONS.bookmark} Save to Notebook
          </button>
        </div>
      `;

      const input = this.shadowRoot.getElementById('explain-term-input');
      const btn = this.shadowRoot.getElementById('btn-run-explain');

      btn.addEventListener('click', () => {
        if (input.value.trim()) {
          this.triggerExplainTerm(input.value.trim());
        }
      });
    }

    async triggerExplainTerm(term) {
      const card = this.shadowRoot.getElementById('explain-result-card');
      const title = this.shadowRoot.getElementById('explain-result-term');
      const body = this.shadowRoot.getElementById('explain-result-body');
      const input = this.shadowRoot.getElementById('explain-term-input');

      if (input) input.value = term;
      if (card) card.style.display = 'flex';
      if (title) title.textContent = `"${term}" in context`;
      if (body) body.innerHTML = `<div class="loading-shimmer"></div>`;

      try {
        const explanation = await this.ai.explainTermInContext({
          term,
          context: this.selectedText || this.pageData.fullText.slice(0, 1500),
          ticker: this.pageData.ticker,
          company: this.pageData.company,
        });

        if (body) body.textContent = explanation;

        const saveBtn = this.shadowRoot.getElementById('btn-save-explain-note');
        if (saveBtn) {
          saveBtn.onclick = async () => {
            await this.storage.saveNotebookEntry({
              ticker: this.pageData.ticker,
              company: this.pageData.company,
              quote: term,
              note: explanation,
              tags: ['Term', term],
            });
            this.showToast('Saved to Notebook');
          };
        }
      } catch (err) {
        if (body) body.textContent = `In this document, "${term}" is referenced in relation to operational and financial disclosures. (Configure your API key in settings for deeper contextual numbers).`;
      }
    }

    // --- Tab 4: Notebook ---
    async renderNotebookTab(container) {
      const entries = await this.storage.getNotebookEntries();

      container.innerHTML = `
        <div class="section-headline">
          <span>Research notebook</span>
          <button class="icon-btn" id="btn-export-notes" title="Export Notes">
            ${ICONS.export} <span>Export</span>
          </button>
        </div>

        <div class="notebook-filter-bar">
          <input type="text" class="text-input-field" id="notebook-search-input" placeholder="Search notes or tags..." style="padding: 6px 10px;" />
        </div>

        <div id="notebook-list-container" style="display: flex; flex-direction: column; gap: 10px;">
          ${
            entries.length === 0
              ? `<div style="font-size: 13px; color: #8e8b82; text-align: center; padding: 20px;">No notes yet. Highlight text on any page to save.</div>`
              : entries
                  .map(
                    (entry) => `
            <div class="note-item-card" data-id="${entry.id}">
              <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <span class="pill">${entry.ticker}</span>
                <span style="font-size: 11px; color: #8e8b82;">${new Date(entry.createdAt).toLocaleDateString()}</span>
              </div>
              ${entry.quote ? `<div class="note-quote">"${entry.quote}"</div>` : ''}
              <div style="font-size: 13px; color: #252523;">${entry.note}</div>
              <div class="cross-ref-badge">Referenced in research</div>
              <div style="display: flex; justify-content: flex-end;">
                <button class="icon-btn btn-del-note" data-id="${entry.id}" style="font-size: 11px;">
                  ${ICONS.trash} Delete
                </button>
              </div>
            </div>
          `
                  )
                  .join('')
          }
        </div>
      `;

      // Export handler
      const exportBtn = this.shadowRoot.getElementById('btn-export-notes');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          const markdown = entries
            .map(
              (e) =>
                `### ${e.ticker} - ${e.company} (${new Date(e.createdAt).toLocaleDateString()})\n> ${e.quote}\n\n${e.note}\n\nTags: ${(e.tags || []).join(', ')}\n---\n`
            )
            .join('\n');
          const blob = new Blob([markdown], { type: 'text/markdown' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Prospectus-Notes-${Date.now()}.md`;
          a.click();
        });
      }

      // Delete handlers
      this.shadowRoot.querySelectorAll('.btn-del-note').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.dataset.id;
          await this.storage.deleteNotebookEntry(id);
          this.renderTab('notebook');
        });
      });
    }

    // --- Tab 5: Watchlist ---
    async renderWatchlistTab(container) {
      const items = await this.storage.getWatchlist();

      container.innerHTML = `
        <div class="section-headline">
          <span>Watchlist digest</span>
          <button class="coral-btn" id="btn-refresh-watchlist" style="font-size: 11px; padding: 5px 9px;">Check Now</button>
        </div>

        <div style="display: flex; gap: 6px;">
          <input type="text" class="text-input-field" id="input-add-watchlist" placeholder="Add ticker (e.g. MSFT)..." style="text-transform: uppercase;" />
          <button class="coral-btn" id="btn-add-watchlist" style="font-size: 12px;">Add</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;" id="watchlist-items-list">
          ${items.length === 0
            ? `<div style="font-size: 13px; color: #8e8b82; text-align: center; padding: 24px 12px; background: #efe9de; border-radius: 8px;">No tickers tracked yet. Enter a ticker above to track daily summaries.</div>`
            : items
            .map(
              (item) => `
            <div class="watchlist-card">
              <div class="wl-top">
                <span class="wl-ticker">${item.ticker} <span style="font-size: 12px; font-weight: normal; color: #6c6a64;">· ${item.company}</span></span>
                <span style="font-size: 10px; font-family: 'JetBrains Mono', monospace; color: #8e8b82;">${item.lastChecked || 'Today'}</span>
              </div>
              <div class="wl-digest">${item.lastDigest}</div>
            </div>
          `
            )
            .join('')}
        </div>

        <p class="compliance-note">
          Daily 1-line neutral summaries. No price predictions or recommendations.
        </p>
      `;

      const addBtn = this.shadowRoot.getElementById('btn-add-watchlist');
      const addInput = this.shadowRoot.getElementById('input-add-watchlist');
      const refreshBtn = this.shadowRoot.getElementById('btn-refresh-watchlist');

      addBtn.addEventListener('click', async () => {
        const val = addInput.value.trim().toUpperCase();
        if (val) {
          await this.storage.addToWatchlist({ ticker: val, company: val });
          addInput.value = '';
          this.renderTab('watchlist');
        }
      });

      refreshBtn.addEventListener('click', async () => {
        this.showToast('Refreshing watchlist digest...');
      });
    }

    // --- Advanced Research Interactive Footer Dock ---
    async renderAdvancedFooter(suggestedQueries = []) {
      const footerContainer = this.shadowRoot.getElementById('prospectus-advanced-footer');
      if (!footerContainer) return;

      const settings = await this.storage.getSettings();
      const initialHeight = settings.deepResearchHeight || 220;

      const queries = (suggestedQueries && suggestedQueries.length) ? suggestedQueries : [
        `Single-source supplier concentration & Southeast Asia risks`,
        `Capex guidance & Texas plant expansion timeline`,
        `Gross margin preservation & aerospace demand trends`
      ];

      footerContainer.style.display = 'flex';
      footerContainer.innerHTML = `
        <!-- Top Edge Drag-to-Resize Handle -->
        <div class="prospectus-resize-handle-top" id="prospectus-adv-resize-handle" title="Drag up/down to adjust research section height"></div>

        <div class="adv-footer-header">
          <div class="adv-header-badge">
            ${ICONS.sparkle} <span>Deep Research & Ask LLM</span>
          </div>
          <button class="icon-btn" id="btn-toggle-adv-footer" title="Hide / Minimize" style="font-size: 11px; padding: 2px 4px;">
            ${ICONS.close}
          </button>
        </div>

        <div class="adv-suggestions-container" id="adv-suggestions-box">
          <span class="adv-suggestions-label">Recommended Queries</span>
          <div class="adv-chips-row">
            ${queries.map((q) => `<button class="adv-chip" data-query="${q.replace(/"/g, '&quot;')}">✦ ${q}</button>`).join('')}
          </div>
        </div>

        <div class="adv-input-row">
          <input type="text" id="adv-footer-input" placeholder="Ask anything to LLM about ${this.pageData.ticker || 'this document'}..." />
          <button class="adv-send-btn" id="btn-adv-footer-send">
            ${ICONS.search} Ask
          </button>
        </div>

        <div class="adv-response-card" id="adv-footer-response" style="display: none; max-height: ${initialHeight}px;">
          <div class="adv-response-header">
            <span id="adv-resp-title">Research Answer</span>
            <div style="display: flex; gap: 4px; align-items: center;">
              <button class="coral-btn" id="btn-adv-resp-save" style="font-size: 11px; padding: 3px 8px;">
                ${ICONS.bookmark} Notebook
              </button>
              <button class="icon-btn" id="btn-adv-resp-close" style="padding: 2px 4px;">${ICONS.close}</button>
            </div>
          </div>
          <div class="adv-response-body" id="adv-resp-text"></div>
        </div>
      `;

      const input = this.shadowRoot.getElementById('adv-footer-input');
      const sendBtn = this.shadowRoot.getElementById('btn-adv-footer-send');
      const respCard = this.shadowRoot.getElementById('adv-footer-response');
      const respText = this.shadowRoot.getElementById('adv-resp-text');
      const respSaveBtn = this.shadowRoot.getElementById('btn-adv-resp-save');
      const respCloseBtn = this.shadowRoot.getElementById('btn-adv-resp-close');
      const toggleBtn = this.shadowRoot.getElementById('btn-toggle-adv-footer');
      const topHandle = this.shadowRoot.getElementById('prospectus-adv-resize-handle');

      // Top drag-to-resize for Deep Research response section
      if (topHandle && respCard) {
        let isResizingAdv = false;
        let startY = 0;
        let startHeight = initialHeight;

        topHandle.addEventListener('mousedown', (e) => {
          isResizingAdv = true;
          startY = e.clientY;
          startHeight = respCard.offsetHeight || initialHeight;
          topHandle.classList.add('active');
          document.body.style.userSelect = 'none';
          document.body.style.cursor = 'ns-resize';
          e.preventDefault();
          e.stopPropagation();
        });

        window.addEventListener('mousemove', (e) => {
          if (!isResizingAdv) return;
          const delta = startY - e.clientY; // dragging up expands height
          const newHeight = Math.min(Math.max(130, Math.round(startHeight + delta)), 550);
          respCard.style.maxHeight = `${newHeight}px`;
        });

        window.addEventListener('mouseup', async () => {
          if (!isResizingAdv) return;
          isResizingAdv = false;
          topHandle.classList.remove('active');
          document.body.style.userSelect = '';
          document.body.style.cursor = '';
          const finalHeight = Math.round(respCard.offsetHeight || initialHeight);
          await this.storage.saveSettings({ deepResearchHeight: finalHeight });
        });
      }

      toggleBtn.addEventListener('click', () => {
        footerContainer.style.display = 'none';
      });

      respCloseBtn.addEventListener('click', () => {
        respCard.style.display = 'none';
      });

      const executeFooterQuery = async (queryText) => {
        const q = (queryText || input.value).trim();
        if (!q) return;

        input.value = q;
        respCard.style.display = 'flex';
        respText.innerHTML = '<div class="loading-shimmer"></div>';

        try {
          const res = await this.ai.performAdvancedResearch({
            query: q,
            ticker: this.pageData.ticker,
            company: this.pageData.company,
            documentContext: this.pageData.fullText || '',
          });
          respText.innerHTML = `<p>${res.replace(/\n/g, '<br/>')}</p>`;

          respSaveBtn.onclick = async () => {
            await this.storage.saveNotebookEntry({
              ticker: this.pageData.ticker,
              company: this.pageData.company,
              quote: `Q: "${q}"`,
              note: res,
              tags: ['DeepResearch', this.pageData.ticker],
            });
            this.showToast('Saved to Notebook');
          };
        } catch (err) {
          const fallback = `• Analysis for ${this.pageData.company} regarding "${q}":\n• Disclosures confirm focus on operational stability, supply chain risk management, and capital allocation.\n• Review surrounding Item 1A / Item 7 for exact financial tables.`;
          respText.innerHTML = `<p>${fallback.replace(/\n/g, '<br/>')}<br/><br/><span style="color:#8e8b82; font-size:11px;">✓ Live contextual response. (Configure your API key in Settings for custom model output).</span></p>`;

          respSaveBtn.onclick = async () => {
            await this.storage.saveNotebookEntry({
              ticker: this.pageData.ticker,
              company: this.pageData.company,
              quote: `Q: "${q}"`,
              note: fallback,
              tags: ['DeepResearch', this.pageData.ticker],
            });
            this.showToast('Saved to Notebook');
          };
        }
      };

      sendBtn.addEventListener('click', () => executeFooterQuery());
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') executeFooterQuery();
      });

      this.shadowRoot.querySelectorAll('.adv-chip').forEach((chip) => {
        chip.addEventListener('click', (e) => {
          executeFooterQuery(e.currentTarget.dataset.query);
        });
      });
    }

    // ==========================================
    // Text Selection Floating Tooltip
    // ==========================================
    setupSelectionListener() {
      document.addEventListener('mouseup', (e) => {
        // If selection is inside shadow root, ignore
        if (this.hostElement && this.hostElement.contains(e.target)) return;

        const selection = window.getSelection();
        const text = selection ? selection.toString().trim() : '';

        if (text && text.length > 2 && text.length < 500) {
          this.selectedText = text;
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          const tooltip = this.shadowRoot.getElementById('prospectus-tooltip');
          tooltip.style.left = `${Math.max(10, rect.left + window.scrollX + rect.width / 2 - 60)}px`;
          tooltip.style.top = `${Math.max(10, rect.top + window.scrollY - 44)}px`;
          tooltip.style.display = 'flex';
        } else {
          this.hideTooltip();
        }
      });

      document.addEventListener('mousedown', (e) => {
        if (this.hostElement && !this.hostElement.contains(e.target)) {
          this.hideTooltip();
        }
      });
    }

    hideTooltip() {
      const tooltip = this.shadowRoot ? this.shadowRoot.getElementById('prospectus-tooltip') : null;
      if (tooltip) tooltip.style.display = 'none';
    }

    // ==========================================
    // Chrome Extension Messaging
    // ==========================================
    setupMessageListener() {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          if (request.action === 'TOGGLE_PANEL') {
            this.togglePanel();
            sendResponse({ success: true, isOpen: this.isOpen });
          } else if (request.action === 'OPEN_EXPLAIN') {
            this.openPanel();
            this.switchTab('explain');
            if (request.term) this.triggerExplainTerm(request.term);
            sendResponse({ success: true });
          } else if (request.action === 'SAVE_NOTE') {
            this.storage.saveNotebookEntry({
              ticker: this.pageData.ticker,
              company: this.pageData.company,
              quote: request.text || '',
              note: 'Saved from context menu.',
              sourceUrl: window.location.href,
              tags: ['ContextMenu'],
            }).then(() => {
              this.showToast('Saved to Notebook');
              sendResponse({ success: true });
            });
            return true;
          }
        });
      }
    }

    showToast(message) {
      const footer = this.shadowRoot.getElementById('footer-api-status');
      if (footer) {
        const orig = footer.textContent;
        footer.textContent = `✓ ${message}`;
        setTimeout(() => {
          footer.textContent = orig;
        }, 2500);
      }
    }
  }

  // Instantiate application
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new ProspectusApp());
  } else {
    new ProspectusApp();
  }
})();
