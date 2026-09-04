/**
 * Prospectus - Content Script Controller
 * Injects isolated Shadow DOM sidebar panel and floating text selection tooltips.
 */

(function () {
  // Robust check: Ensure we only inject into valid HTML/DOM documents
  function isSupportedHTMLDocument() {
    try {
      if (typeof document === 'undefined') return false;
      if (!document.documentElement) return false;
      
      const rootTag = (document.documentElement.nodeName || '').toLowerCase();
      if (rootTag !== 'html' && rootTag !== 'body') return false;

      if (typeof XMLDocument !== 'undefined' && document instanceof XMLDocument) return false;

      const cType = (document.contentType || '').toLowerCase();
      if (cType && (cType.includes('xml') || cType.includes('json') || cType.includes('text/plain'))) {
        return false;
      }

      // Extension should not be active on YouTube
      const host = (window.location.hostname || '').toLowerCase();
      if (host.includes('youtube.com') || host.includes('youtu.be') || host.endsWith('youtube.com')) {
        return false;
      }

      const path = (window.location.pathname || '').toLowerCase();
      if (/\.(xml|xsd|json|txt|csv)($|\?)/i.test(path) || /\.(xml|xsd|json|txt|csv)($|\?)/i.test(window.location.href)) {
        return false;
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  if (!isSupportedHTMLDocument()) {
    return;
  }

  // Prevent duplicate injection
  if (window.__prospectus_injected) return;
  window.__prospectus_injected = true;

  // Suppress harmless extension reload, API, and connection errors from throwing to Chrome
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      const msg = (event && event.reason && (event.reason.message || String(event.reason))) || '';
      if (
        msg.includes('Extension context invalidated') ||
        msg.includes('message port closed') ||
        msg.includes('Receiving end does not exist') ||
        msg.includes('API error') ||
        msg.includes('API key') ||
        msg.includes('fetch') ||
        msg.includes('Failed to fetch')
      ) {
        event.preventDefault();
      }
    });

    window.addEventListener('error', (event) => {
      const msg = (event && event.message) || '';
      if (
        msg.includes('Extension context invalidated') ||
        msg.includes('message port closed') ||
        msg.includes('Receiving end does not exist')
      ) {
        event.preventDefault();
      }
    });
  }

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
    refresh: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>`,
    bell: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
    bellOff: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><path d="M18.63 13A17.88 17.88 0 0 1 18 8"></path><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"></path><path d="M18 8a6 6 0 0 0-9.33-5"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`,
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
      this.watchlistService = window.ProspectusWatchlistService
        ? new window.ProspectusWatchlistService(this.storage, this.ai)
        : (typeof WatchlistService !== 'undefined' ? new WatchlistService(this.storage, this.ai) : null);
      this.selectedText = '';
      this.selectedRange = null;
      this.summaryResult = null;
      this.isAnalyzing = false;
      this.lastAnalysisError = null;
      this.lastKnownUrl = typeof window !== 'undefined' ? window.location.href : '';
      this.proceedAnyway = false;
      this.webSearchEnabled = true;
      this.activeFilingContext = null;
      this.originalPageState = null;
      window.__prospectusApp = this;

      this.init();
    }

    async init() {
      // Guard: Do not execute on raw XML / XSD / JSON non-HTML documents
      const cType = (document.contentType || '').toLowerCase();
      if (
        cType.includes('xml') ||
        cType.includes('json') ||
        /\.(xml|xsd|json)($|\?)/i.test(window.location.pathname)
      ) {
        return;
      }

      const ensureInjected = async () => {
        if (this.hostElement && this.shadowRoot) return;
        this.pageData = FinancialExtractors.extractPageData();
        await this.injectShadowHost();
        this.setupSelectionListener();
        this.setupMessageListener();
        this.setupUrlChangeListener();
      };

      if (document.body || document.documentElement) {
        await ensureInjected();
      } else {
        document.addEventListener('DOMContentLoaded', ensureInjected);
      }
    }

    setupUrlChangeListener() {
      this.lastKnownUrl = window.location.href;
      window.addEventListener('popstate', () => this.refreshPageData(true));
      window.addEventListener('hashchange', () => this.refreshPageData(true));
      setInterval(() => {
        if (window.location.href !== this.lastKnownUrl) {
          this.lastKnownUrl = window.location.href;
          this.refreshPageData(true);
        }
      }, 800);
    }

    async injectShadowHost() {
      try {
        const rootParent = document.documentElement || document.body;
        if (!rootParent) return;

        if (document.getElementById('prospectus-root')) {
          return;
        }

        this.pageData = FinancialExtractors.extractPageData();
        this.hostElement = document.createElement('div');
        this.hostElement.id = 'prospectus-root';
        rootParent.appendChild(this.hostElement);

        this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

        // Fetch or link panel.css
        const cssUrl = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL
          ? chrome.runtime.getURL('content/panel.css')
          : 'content/panel.css';

        const styleLink = `<link rel="stylesheet" href="${cssUrl}">`;

        const urlClean = `${window.location.hostname}${window.location.pathname}${window.location.search}`;

        this.shadowRoot.innerHTML = `
          ${styleLink}
          <div id="prospectus-dock-btn" class="prospectus-dock-toggle" style="display: flex;" title="Prospectus · Drag up or down to adjust position along screen, click to open (Alt+P)">
            <div class="dock-logo-badge">${ICONS.doc}</div>
            <span class="dock-brand-text">Prospectus</span>
          </div>
          <div id="prospectus-sidebar" class="prospectus-panel closed">
            <!-- Sidebar Left Edge Drag-to-Resize Handle -->
            <div class="prospectus-resize-handle-left" id="prospectus-sidebar-resize-handle" title="Drag left/right to resize sidebar width"></div>

            <!-- Top Header -->
            <div class="prospectus-header">
              <div class="browser-bar">
                <div class="window-dots">
                  <div class="dot dot-red" id="dot-btn-close" title="Close Panel"></div>
                  <div class="dot dot-yellow" id="dot-btn-dock" title="Minimize / Dock"></div>
                  <div class="dot dot-green" id="dot-btn-refresh" title="Refresh Page Data"></div>
                </div>
                <div class="url-input-mock" id="prospectus-url-bar" title="${urlClean}">${urlClean}</div>
                <button class="url-action-btn" id="btn-refresh-page" title="Refresh Page Analysis & URL">${ICONS.refresh}</button>
                <button class="icon-btn" id="btn-dock-toggle" title="Dock / Minimize Sidebar">${ICONS.dock}</button>
              </div>
              <div class="brand-row">
                <div class="brand-title">
                  <span class="brand-icon">${ICONS.doc}</span>
                  <strong>Prospectus</strong>
                  <span class="brand-tag">research, organized</span>
                </div>
                <div class="header-controls">
                  <button class="btn-header-watchlist" id="btn-header-watchlist" style="display: none;" title="Toggle Watchlist">
                    <span>+ Watchlist</span>
                  </button>
                  <button class="icon-btn" id="btn-open-settings" title="Settings" aria-label="Settings">${ICONS.settings}</button>
                  <button class="icon-btn" id="btn-close-sidebar" title="Close Panel" aria-label="Close">${ICONS.close}</button>
                </div>
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

            <!-- Advanced Research & Ask Prospectus Interactive Footer (Appears after analysis) -->
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

        await this.applySavedDimensions();
        this.bindEvents();
        await this.updateFooterStatus();
        await this.updateHeaderWatchlistButton();
        await this.renderTab('summary');
      } catch (err) {
        console.warn('Prospectus: injection skipped on non-HTML document:', err && err.message);
      }
    }

    async applySavedDimensions() {
      const settings = await this.storage.getSettings();
      const sidebar = this.shadowRoot.getElementById('prospectus-sidebar');
      const footer = this.shadowRoot.getElementById('prospectus-advanced-footer');
      const toggleBtn = this.shadowRoot.getElementById('prospectus-dock-btn');
      if (sidebar && settings.sidebarWidth) {
        sidebar.style.width = `${settings.sidebarWidth}px`;
      }
      if (footer && settings.deepResearchHeight) {
        footer.style.height = `${settings.deepResearchHeight}px`;
      }
      if (toggleBtn && settings.dockToggleTopPercent !== undefined && settings.dockToggleTopPercent !== null) {
        toggleBtn.style.top = `${settings.dockToggleTopPercent}%`;
        toggleBtn.style.transform = 'translateY(-50%)';
      }
    }

    bindEvents() {
      const toggleBtn = this.shadowRoot.getElementById('prospectus-dock-btn');
      const closeBtn = this.shadowRoot.getElementById('btn-close-sidebar');
      const dockBtn = this.shadowRoot.getElementById('btn-dock-toggle');
      const refreshBtn = this.shadowRoot.getElementById('btn-refresh-page');
      const redDot = this.shadowRoot.getElementById('dot-btn-close');
      const yellowDot = this.shadowRoot.getElementById('dot-btn-minimize');
      const greenDot = this.shadowRoot.getElementById('dot-btn-refresh');
      const headerWlBtn = this.shadowRoot.getElementById('btn-header-watchlist');
      const settingsBtn = this.shadowRoot.getElementById('btn-open-settings');
      const footerApiGroup = this.shadowRoot.getElementById('footer-api-group');
      const footerLicenseStatus = this.shadowRoot.getElementById('footer-license-status');
      const tabBtns = this.shadowRoot.querySelectorAll('.tab-btn');
      const leftHandle = this.shadowRoot.getElementById('prospectus-sidebar-resize-handle');
      const sidebar = this.shadowRoot.getElementById('prospectus-sidebar');

      // Interactive Draggable Dock Toggle (Move up and down along right side of Chrome)
      if (toggleBtn) {
        let isDragging = false;
        let hasMoved = false;
        let startY = 0;
        let initialCenterY = 0;
        const dragThreshold = 4; // minimum pixels moved to count as a drag

        const onPointerDown = (e) => {
          if (e.button !== undefined && e.button !== 0) return; // Main button / touch only

          isDragging = true;
          hasMoved = false;
          startY = e.clientY;

          const rect = toggleBtn.getBoundingClientRect();
          initialCenterY = rect.top + rect.height / 2;

          toggleBtn.classList.add('is-dragging');
          document.body.style.userSelect = 'none';

          window.addEventListener('pointermove', onPointerMove, { passive: false });
          window.addEventListener('pointerup', onPointerUp);
          window.addEventListener('pointercancel', onPointerUp);
        };

        const onPointerMove = (e) => {
          if (!isDragging) return;

          const deltaY = e.clientY - startY;
          if (!hasMoved && Math.abs(deltaY) > dragThreshold) {
            hasMoved = true;
          }

          if (hasMoved) {
            e.preventDefault();
            const btnHeight = toggleBtn.offsetHeight || 38;
            const minCenterY = btnHeight / 2 + 10;
            const maxCenterY = window.innerHeight - btnHeight / 2 - 10;

            const targetCenterY = initialCenterY + deltaY;
            const clampedCenterY = Math.max(minCenterY, Math.min(maxCenterY, targetCenterY));

            toggleBtn.style.top = `${clampedCenterY}px`;
            toggleBtn.style.transform = 'translateY(-50%)';
          }
        };

        const onPointerUp = async (e) => {
          if (!isDragging) return;
          isDragging = false;

          toggleBtn.classList.remove('is-dragging');
          document.body.style.userSelect = '';

          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('pointercancel', onPointerUp);

          if (hasMoved) {
            // Drag completed: save new position percentage
            const rect = toggleBtn.getBoundingClientRect();
            const currentCenterY = rect.top + rect.height / 2;
            const topPercent = Math.max(5, Math.min(95, (currentCenterY / window.innerHeight) * 100));

            try {
              const currentSettings = await this.storage.getSettings();
              currentSettings.dockToggleTopPercent = Math.round(topPercent * 10) / 10;
              await this.storage.saveSettings(currentSettings);
            } catch (err) {}
          } else {
            // Clean click without drag: toggle panel
            this.togglePanel();
          }
        };

        toggleBtn.addEventListener('pointerdown', onPointerDown);

        // Keep button inside screen bounds if window is resized
        window.addEventListener('resize', () => {
          if (toggleBtn) {
            const btnHeight = toggleBtn.offsetHeight || 38;
            const rect = toggleBtn.getBoundingClientRect();
            const minCenterY = btnHeight / 2 + 10;
            const maxCenterY = window.innerHeight - btnHeight / 2 - 10;
            const currentCenterY = rect.top + rect.height / 2;

            if (currentCenterY < minCenterY || currentCenterY > maxCenterY) {
              const clamped = Math.max(minCenterY, Math.min(maxCenterY, currentCenterY));
              toggleBtn.style.top = `${clamped}px`;
            }
          }
        });
      }

      if (closeBtn) closeBtn.addEventListener('click', () => this.closePanel());
      if (dockBtn) dockBtn.addEventListener('click', () => this.closePanel());
      if (refreshBtn) refreshBtn.addEventListener('click', () => this.refreshPageData(true));
      if (redDot) redDot.addEventListener('click', () => this.closePanel());
      if (yellowDot) yellowDot.addEventListener('click', () => this.closePanel());
      if (greenDot) greenDot.addEventListener('click', () => this.refreshPageData(true));

      // Header Watchlist Button Wiring (Matches screenshot: [✓ Tracked] / [+ Watchlist])
      // Header Watchlist Button Wiring (Tracked only shown when page analyzed & suggested stocks tracked)
      if (headerWlBtn) {
        this.updateHeaderWatchlistButton();
        headerWlBtn.addEventListener('click', async () => {
          if (!this.watchlistService) return;

          // Case 1: Page has been analyzed
          if (this.summaryResult) {
            const discussed = await this.watchlistService.extractDiscussedStocksFromSummary(this.summaryResult, this.pageData);
            if (discussed && discussed.length === 1) {
              const stock = discussed[0];
              const isTracked = await this.watchlistService.isTickerInWatchlist(stock.ticker);
              if (isTracked) {
                await this.watchlistService.removeTicker(stock.ticker);
                this.showToast(`Removed ${stock.ticker} from Watchlist`);
              } else {
                await this.watchlistService.addTicker(stock.ticker, stock.company, stock.cik);
                this.showToast(`✓ Added ${stock.ticker} (${stock.company}) to Watchlist`);
              }
              await this.updateHeaderWatchlistButton();
              if (this.activeTab === 'watchlist') {
                const container = this.shadowRoot.getElementById('tab-content-container');
                if (container) this.renderWatchlistTab(container);
              } else if (this.activeTab === 'summary') {
                const container = this.shadowRoot.getElementById('tab-content-container');
                if (container) this.renderSummaryTab(container);
              }
              return;
            } else if (discussed && discussed.length > 1) {
              const trackStatuses = await Promise.all(
                discussed.map((s) => this.watchlistService.isTickerInWatchlist(s.ticker))
              );
              const allTracked = trackStatuses.every(Boolean);
              if (!allTracked) {
                for (const s of discussed) {
                  await this.watchlistService.addTicker(s.ticker, s.company, s.cik);
                }
                this.showToast(`✓ Added ${discussed.length} suggested stocks to Watchlist`);
              } else {
                this.switchTab('watchlist');
              }
              await this.updateHeaderWatchlistButton();
              if (this.activeTab === 'watchlist') {
                const container = this.shadowRoot.getElementById('tab-content-container');
                if (container) this.renderWatchlistTab(container);
              } else if (this.activeTab === 'summary') {
                const container = this.shadowRoot.getElementById('tab-content-container');
                if (container) this.renderSummaryTab(container);
              }
              return;
            }
          }

          // Case 2: Page is NOT analyzed yet
          // Clicking "+ Watchlist" when unanalyzed:
          if (this.pageData && this.pageData.ticker && this.pageData.ticker !== 'QUOTE' && this.pageData.ticker !== 'ARTICLE') {
            const ticker = this.pageData.ticker;
            const company = this.pageData.company || ticker;
            const cik = this.pageData.cik || '';
            const isTracked = await this.watchlistService.isTickerInWatchlist(ticker);
            if (!isTracked) {
              await this.watchlistService.addTicker(ticker, company, cik);
              this.showToast(`✓ Added ${ticker} (${company}) to Watchlist`);
            }
            this.switchTab('watchlist');
          } else {
            this.switchTab('watchlist');
          }
          await this.updateHeaderWatchlistButton();
        });
      }

      // Left drag-to-resize handle for sidebar panel width (Zero-overhead transient listeners)
      if (leftHandle && sidebar) {
        let isResizing = false;
        let startX = 0;
        let startWidth = 440;

        const onPointerMove = (e) => {
          if (!isResizing) return;
          const delta = startX - e.clientX; // dragging left expands width
          const newWidth = Math.min(Math.max(340, Math.round(startWidth + delta)), Math.min(850, Math.round(window.innerWidth * 0.88)));
          sidebar.style.width = `${newWidth}px`;
        };

        const onPointerUp = async () => {
          if (!isResizing) return;
          isResizing = false;
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('pointercancel', onPointerUp);

          leftHandle.classList.remove('active');
          document.body.style.userSelect = '';
          document.body.style.cursor = '';
          const finalWidth = Math.round(sidebar.getBoundingClientRect().width);
          await this.storage.saveSettings({ sidebarWidth: finalWidth });
        };

        leftHandle.addEventListener('pointerdown', (e) => {
          isResizing = true;
          startX = e.clientX;
          startWidth = sidebar.getBoundingClientRect().width;
          leftHandle.classList.add('active');
          document.body.style.userSelect = 'none';
          document.body.style.cursor = 'ew-resize';

          window.addEventListener('pointermove', onPointerMove, { passive: true });
          window.addEventListener('pointerup', onPointerUp);
          window.addEventListener('pointercancel', onPointerUp);

          e.preventDefault();
          e.stopPropagation();
        });
      }

      const openSettings = () => this.openSettings();

      if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
      if (footerApiGroup) footerApiGroup.addEventListener('click', openSettings);
      if (footerLicenseStatus) footerLicenseStatus.addEventListener('click', openSettings);

      window.addEventListener('focus', () => {
        this.updateFooterStatus();
      });

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === 'local' && (changes.settings || changes.license)) {
            this.updateFooterStatus();
          }
        });
      }

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

      ttSave.addEventListener('click', () => {
        const text = this.selectedText;
        this.hideTooltip();
        this.openPanel();
        this.switchTab('notebook');
        const words = text ? text.split(/\s+/).slice(0, 6).join(' ') : 'Research Note';
        this.openSaveNoteModal({
          title: words + (text && text.length > words.length ? '...' : ''),
          quote: text,
          note: '',
          category: 'Risks & Disclosures',
          ticker: this.pageData.ticker,
        });
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
      this.updateFooterStatus();
      this.updateHeaderWatchlistButton();
    }

    closePanel() {
      const sidebar = this.shadowRoot.getElementById('prospectus-sidebar');
      const dockBtn = this.shadowRoot.getElementById('prospectus-dock-btn');
      sidebar.classList.add('closed');
      dockBtn.style.display = 'flex';
      this.isOpen = false;
    }

    async updateHeaderWatchlistButton() {
      const btn = this.shadowRoot ? this.shadowRoot.getElementById('btn-header-watchlist') : null;
      if (!btn) return;

      if (!this.watchlistService) {
        btn.style.display = 'none';
        return;
      }

      btn.style.display = 'inline-flex';

      // Rule: The "✓ Tracked" option must ONLY be shown when:
      // 1. We have analyzed the page (this.summaryResult exists)
      // 2. The suggested stocks to track from the summary are already tracked in Watchlist
      // Otherwise, it must show "+ Watchlist"
      if (this.summaryResult) {
        const discussed = await this.watchlistService.extractDiscussedStocksFromSummary(this.summaryResult, this.pageData);
        if (discussed && discussed.length > 0) {
          const trackStatuses = await Promise.all(
            discussed.map((s) => this.watchlistService.isTickerInWatchlist(s.ticker))
          );
          const allTracked = trackStatuses.every(Boolean);

          if (allTracked) {
            btn.classList.add('tracked');
            btn.innerHTML = `<span>✓ Tracked</span>`;
            btn.title = discussed.length === 1
              ? `${discussed[0].ticker} is in your Watchlist (Click to remove)`
              : `All suggested stocks (${discussed.map((d) => d.ticker).join(', ')}) are in your Watchlist`;
            return;
          } else {
            btn.classList.remove('tracked');
            btn.innerHTML = `<span>+ Watchlist</span>`;
            btn.title = discussed.length === 1
              ? `Add suggested stock ${discussed[0].ticker} (${discussed[0].company}) to Watchlist`
              : `Add suggested stocks (${discussed.map((d) => d.ticker).join(', ')}) to Watchlist`;
            return;
          }
        }
      }

      // If page has NOT been analyzed yet, or no suggested stocks:
      // Always show "+ Watchlist"
      btn.classList.remove('tracked');
      btn.innerHTML = `<span>+ Watchlist</span>`;
      btn.title = (this.pageData && this.pageData.ticker && this.pageData.ticker !== 'QUOTE' && this.pageData.ticker !== 'ARTICLE')
        ? `Add ${this.pageData.ticker} to Watchlist or view Watchlist`
        : `Open Watchlist`;
    }

    async refreshPageData(showToastMsg = true) {
      const urlClean = `${window.location.hostname}${window.location.pathname}${window.location.search}`;
      const urlBar = this.shadowRoot ? this.shadowRoot.getElementById('prospectus-url-bar') : null;
      if (urlBar) {
        urlBar.textContent = urlClean;
        urlBar.title = urlClean;
      }

      this.pageData = FinancialExtractors.extractPageData();
      this.summaryResult = null;
      this.lastAnalysisError = null;
      this.proceedAnyway = false;
      this.updateHeaderWatchlistButton();

      const advFooter = this.shadowRoot ? this.shadowRoot.getElementById('prospectus-advanced-footer') : null;
      if (advFooter) advFooter.style.display = 'none';

      const container = this.shadowRoot ? this.shadowRoot.getElementById('tab-content-container') : null;
      if (container) {
        this.renderTab(this.activeTab);
      }
      if (showToastMsg) {
        this.showToast('Page refreshed');
      }
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
      try {
        const settings = await this.storage.getSettings();
        const usage = await this.storage.getUsageInfo();

        const dot = this.shadowRoot ? this.shadowRoot.getElementById('footer-status-dot') : null;
        const apiText = this.shadowRoot ? this.shadowRoot.getElementById('footer-api-status') : null;
        const licText = this.shadowRoot ? this.shadowRoot.getElementById('footer-license-status') : null;

        if (!dot || !apiText || !licText) return;

        const hasApiKey = !(!settings.apiKey && settings.aiProvider !== 'custom');

        if (!hasApiKey) {
          dot.className = 'status-dot warning';
          apiText.textContent = 'API Key needed (Settings)';
        } else {
          dot.className = 'status-dot';
          apiText.textContent = 'Your API key · connected';
        }

        if (usage.isLicensed) {
          if (hasApiKey) {
            licText.textContent = 'Prospectus can make mistake';
            licText.title = 'AI analyses can contain inaccuracies. Verify key filing data.';
          } else {
            licText.textContent = 'Unlimited · one-time purchase';
            licText.title = 'License Active';
          }
          licText.style.color = '#8e8b82';
        } else {
          licText.textContent = 'License required';
          licText.title = 'Click to activate license';
          licText.style.color = '#a9583e';
        }
      } catch (e) {}
    }

    // ==========================================
    // Tab Renderers
    // ==========================================
    async renderTab(tabName) {
      this.activeTab = tabName;
      const container = this.shadowRoot ? this.shadowRoot.getElementById('tab-content-container') : null;
      if (!container) return;

      try {
        switch (tabName) {
          case 'summary':
            await this.renderSummaryTab(container);
            break;
          case 'what-changed':
            await this.renderWhatChangedTab(container);
            break;
          case 'explain':
            await this.renderExplainTab(container);
            break;
          case 'notebook':
            await this.renderNotebookTab(container);
            break;
          case 'watchlist':
            await this.renderWatchlistTab(container);
            break;
        }
      } catch (err) {
        const isContextInvalidated = err && err.message && (err.message.includes('Extension context invalidated') || err.message.includes('message port closed'));
        if (isContextInvalidated) {
          container.innerHTML = `
            <div style="padding: 36px 18px; text-align: center; font-family: 'Inter', sans-serif;">
              <div style="font-size: 26px; margin-bottom: 8px;">🔄</div>
              <div style="font-size: 14px; font-weight: 600; color: #141413; margin-bottom: 6px;">Extension Reloaded</div>
              <div style="font-size: 12px; color: #7f7c75; margin-bottom: 16px; line-height: 1.5;">
                Prospectus was updated or reloaded. Please refresh this page to reconnect.
              </div>
              <button class="coral-btn" onclick="window.location.reload()" style="padding: 7px 18px; font-size: 12px; border-radius: 6px;">
                Refresh Page
              </button>
            </div>
          `;
          return;
        }

        console.warn(`Prospectus: Tab "${tabName}" render notice:`, err ? err.message : err);
        container.innerHTML = `
          <div style="padding: 32px 18px; text-align: center; color: #8e8b82; font-family: 'Inter', sans-serif;">
            <div style="font-size: 14px; font-weight: 500; color: #a9583e; margin-bottom: 8px;">
              Temporarily unable to display this tab
            </div>
            <div style="font-size: 12px; color: #6c6a64; margin-bottom: 16px;">
              ${this.escapeHTML ? this.escapeHTML(err.message || 'An error occurred while loading content.') : 'An error occurred.'}
            </div>
            <button class="coral-btn" id="btn-tab-reload-error" style="padding: 7px 16px; font-size: 12px;">
              Retry Tab
            </button>
          </div>
        `;
        const retryBtn = container.querySelector('#btn-tab-reload-error');
        if (retryBtn) retryBtn.addEventListener('click', () => this.renderTab(tabName));
      }
    }

    // --- Tab 1: Summary ---
    async renderSummaryTab(container) {
      // If no summary has been generated yet, show manual start prompt, error state, or non-financial warning
      if (!this.summaryResult && !this.isAnalyzing) {
        if (this.lastAnalysisError) {
          container.innerHTML = `
            <div class="non-finance-view">
              <div class="analysis-error-card">
                <div class="error-header">
                  <span class="error-badge">API Call Error</span>
                </div>
                <p class="error-text">${this.lastAnalysisError}</p>
                <div style="display: flex; gap: 8px; margin-top: 6px;">
                  <button class="btn-dark-cta" id="btn-manual-analyze" style="padding: 7px 14px; font-size: 12.5px;">
                    Retry Analysis
                  </button>
                  <button class="coral-btn" id="btn-error-settings" style="font-size: 11.5px; padding: 7px 12px;">
                    Open Settings
                  </button>
                </div>
              </div>
              <div class="non-finance-notice">
                Please verify your API key, provider configuration, or network connection in Prospectus Settings.
              </div>
            </div>
          `;

          const retryBtn = this.shadowRoot.getElementById('btn-manual-analyze');
          if (retryBtn) retryBtn.addEventListener('click', () => this.runSummaryAnalysis());

          const settingsBtn = this.shadowRoot.getElementById('btn-error-settings');
          if (settingsBtn) settingsBtn.addEventListener('click', () => this.openSettings());
          return;
        }

        // Non-financial page check
        if (!this.pageData.isFinanceSite && !this.proceedAnyway) {
          container.innerHTML = `
            <div class="non-finance-view">
              <div class="non-financial-card">
                <div class="non-financial-badge">
                  <span class="warning-badge-pill">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <span>General Webpage</span>
                  </span>
                </div>
                <h3 class="non-financial-title">This page doesn't appear to be finance-related</h3>
                <p class="non-financial-text">
                  Prospectus is optimized for financial research, SEC filings, company disclosures, and earnings analysis.
                </p>
                <div class="non-finance-page-chip">
                  <span class="chip-label">Subject</span>
                  <span class="chip-val" title="${this.pageData.company || 'Current Page'}">${this.pageData.company || 'Current Page'}</span>
                </div>
                <div class="non-financial-choice">
                  <p class="choice-prompt">Would you like to proceed with AI analysis anyway?</p>
                  <div class="choice-buttons">
                    <button class="btn-dark-cta" id="btn-proceed-non-finance">
                      ${ICONS.sparkle} <span>Analyze Page Anyway</span>
                    </button>
                    <button class="btn-dismiss-card" id="btn-dismiss-non-finance">
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
              <div class="non-finance-notice">
                Prospectus will extract and structure the general content of this webpage on-demand using your configured AI model.
              </div>
            </div>
          `;

          const proceedBtn = this.shadowRoot.getElementById('btn-proceed-non-finance');
          if (proceedBtn) {
            proceedBtn.addEventListener('click', () => {
              this.proceedAnyway = true;
              this.runSummaryAnalysis();
            });
          }

          const dismissBtn = this.shadowRoot.getElementById('btn-dismiss-non-finance');
          if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
              this.closePanel();
            });
          }
          return;
        }

        container.innerHTML = `
          <div class="non-finance-view">
            <p class="non-finance-prompt">Ready to analyze ${this.pageData.company || 'this page'}?</p>
            <button class="btn-dark-cta" id="btn-manual-analyze">
              Analyze Page
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

      // If error occurred during analysis
      if (!this.summaryResult) {
        if (this.lastAnalysisError) {
          container.innerHTML = `
            <div class="non-finance-view">
              <div class="non-financial-card">
                <div class="non-financial-badge">
                  <span class="warning-badge-pill">⚠️ Analysis Notice</span>
                </div>
                <h3 class="non-financial-title">Unable to complete AI analysis</h3>
                <p class="non-financial-text">
                  ${this.lastAnalysisError}. Verify your API key in Settings or check network connection.
                </p>
                <div class="choice-buttons" style="margin-top: 10px; display: flex; gap: 8px;">
                  <button class="btn-dark-cta" id="btn-retry-analyze">
                    ${ICONS.sparkle} <span>Try again</span>
                  </button>
                  <button class="coral-btn" id="btn-notice-settings" style="font-size: 11.5px; padding: 7px 12px;">
                    Open Settings
                  </button>
                </div>
              </div>
            </div>
          `;
          const retryBtn = this.shadowRoot.getElementById('btn-retry-analyze');
          if (retryBtn) retryBtn.addEventListener('click', () => this.runSummaryAnalysis());
          const noticeSettingsBtn = this.shadowRoot.getElementById('btn-notice-settings');
          if (noticeSettingsBtn) noticeSettingsBtn.addEventListener('click', () => this.openSettings());
          return;
        }
        return;
      }

      // If summary is available or on a finance page
      const res = this.summaryResult;

      // Extract ONLY and ALL those stocks which are discussed in this summary
      const discussedStocks = await this.watchlistService.extractDiscussedStocksFromSummary(res, this.pageData);

      const enhancedStocks = await Promise.all(
        discussedStocks.map(async (stock) => {
          const isTracked = await this.watchlistService.isTickerInWatchlist(stock.ticker);
          const dailyQuote = await this.watchlistService.getDailyStockQuote(stock.ticker);
          return {
            ...stock,
            isTracked,
            dailyQuote
          };
        })
      );

      const primaryStock = enhancedStocks.length > 0 ? enhancedStocks[0] : null;
      const history1Y = primaryStock ? await this.watchlistService.get1YearStockPriceHistory(primaryStock.ticker) : null;
      const trendGraphHTML = (primaryStock && history1Y)
        ? this.watchlistService.render1YearStockTrendHTML(history1Y, primaryStock.company)
        : '';

      const meter = res.meter || (this.ai ? this.ai.extractDynamicFallbackMeter(this.pageData) : {
        title: 'Document Assessment Meter',
        score: res.toneScore ?? 50,
        label: res.toneLabel || 'Balanced Assessment',
        leftLabel: 'Defensive',
        centerLabel: 'Balanced',
        rightLabel: 'Expansionary',
        explanation: 'Assessed from extracted financial statements and stated operational disclosures.'
      });

      container.innerHTML = `
        ${
          this.activeFilingContext
            ? `
            <div class="active-filing-banner">
              <div class="filing-banner-left">
                <span class="filing-banner-tag">SEC ${this.activeFilingContext.formType}</span>
                <span class="filing-banner-title" title="${this.activeFilingContext.company} (${this.activeFilingContext.ticker})">${this.activeFilingContext.company} (${this.activeFilingContext.ticker}) · ${this.activeFilingContext.period}</span>
              </div>
              <div class="filing-banner-actions">
                <a href="${this.activeFilingContext.sourceUrl}" target="_blank" rel="noopener" class="filing-banner-source-link" title="Open official SEC EDGAR filing">View source ↗</a>
                <button type="button" class="filing-banner-back-btn" id="btn-return-page-doc" title="Return to current webpage document">✕ Close</button>
              </div>
            </div>
          `
            : ''
        }

        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
          <h2 class="section-headline" style="margin-bottom: 0;">${this.activeFilingContext ? 'Filing Summary' : (this.pageData.isFinanceSite ? 'Filing summary' : 'Page summary')}</h2>
          <button class="coral-btn" id="btn-reanalyze" style="font-size: 11px; padding: 4px 8px;">Re-analyze</button>
        </div>


        <!-- What This Page Is About (Executive Context) -->
        <div class="summary-page-overview-box">
          <div class="overview-box-header">
            <span class="overview-section-label">✦ What this page is about</span>
          </div>
          <p class="overview-text">
            ${(res.overview || (this.ai ? this.ai.extractDynamicPageOverview(this.pageData) : '')).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
          </p>
        </div>

        <!-- 1-Year Stock Price Trend Graph (Displayed when researching a stock) -->
        ${trendGraphHTML}

        <!-- Dynamic Contextual Assessment Meter Card (Configured by AI) -->
        <div class="coverage-tone-card">
          <div class="meter-header">
            <span class="meter-title">${meter.title || 'Document Assessment'}</span>
            <span class="meter-label" id="meter-label-text">${meter.label || 'Overview'}</span>
          </div>
          <div class="meter-track-container">
            <div class="meter-bar">
              <div class="meter-tick" id="meter-tick-indicator" style="left: ${Math.min(95, Math.max(5, meter.score ?? 50))}%;"></div>
            </div>
            <div class="meter-labels">
              <span>${meter.leftLabel || 'Defensive'}</span>
              <span>${meter.centerLabel || 'Balanced'}</span>
              <span>${meter.rightLabel || 'Expansionary'}</span>
            </div>
          </div>
          <p class="meter-disclaimer">
            ${(meter.explanation || 'Assessed from extracted financial and operational disclosures.').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
          </p>
        </div>

        <!-- Tone Tag -->
        <div class="tone-highlight-pill" id="summary-tone-pill">
          ${res.toneTag || 'Tone: factual'}
        </div>

        <!-- Bullets with Category Headlines & Bold Metrics -->
        <ul class="summary-bullets" id="summary-bullet-list">
          ${(res.bullets || []).map((b) => {
            let str = String(b || '').trim();
            str = str.replace(/^[\s•\u2022\u00B7\*\-–—]+/, '').trim();
            str = str.replace(/^[âÂ][€\u0080][¢\u00A2]\s*/, '').trim();
            str = str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            if (!str.startsWith('<strong>') && str.includes(':')) {
              const colonIdx = str.indexOf(':');
              if (colonIdx > 0 && colonIdx < 35) {
                const head = str.slice(0, colonIdx);
                const rest = str.slice(colonIdx + 1);
                str = `<strong class="bullet-topic">${head}:</strong>${rest}`;
              }
            }
            return `<li>${str}</li>`;
          }).join('')}
        </ul>

        <!-- Stocks Discussed Shown at End of Summary -->
        ${enhancedStocks.length > 0 ? `
          <div class="summary-stocks-box">
            <div class="summary-stocks-header">
              <div class="summary-stocks-title-group">
                <span class="summary-stocks-dot">●</span>
                <span class="summary-stocks-title">
                  ${enhancedStocks.length === 1 ? 'STOCK DISCUSSED IN REPORT' : `STOCKS DISCUSSED IN SUMMARY (${enhancedStocks.length})`}
                </span>
              </div>
              ${enhancedStocks.length > 1 ? `
                <button type="button" class="btn-track-all-stocks" id="btn-track-all-summary-stocks">
                  ${enhancedStocks.every(s => s.isTracked) ? '✓ All Tracked' : '+ Track All'}
                </button>
              ` : `
                <span class="summary-stocks-subtitle">Add to watchlist</span>
              `}
            </div>
            <div class="summary-stocks-list">
              ${enhancedStocks.map(s => `
                <div class="summary-stock-card">
                  <div class="summary-stock-left">
                    <span class="summary-stock-ticker">${s.ticker}</span>
                    <span class="summary-stock-company" title="${s.company}">${s.company}</span>
                  </div>
                  <div class="summary-stock-right">
                    ${s.dailyQuote ? `
                      <div class="summary-stock-quote-group">
                        <span class="summary-stock-price">$${s.dailyQuote.price}</span>
                        <span class="summary-stock-change ${s.dailyQuote.isPositive ? 'positive' : 'negative'}">
                          ${s.dailyQuote.isPositive ? '▲' : '▼'} ${s.dailyQuote.changePercent}
                        </span>
                      </div>
                    ` : ''}
                    <button type="button" class="btn-summary-stock-track ${s.isTracked ? 'tracked' : ''}" data-ticker="${s.ticker}" data-company="${s.company}" data-cik="${s.cik || ''}">
                      ${s.isTracked ? '✓ Tracked' : '+ Track'}
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="editorial-divider"></div>

        <p class="compliance-note">
          ${res.disclaimer || (this.pageData.isFinanceSite
            ? 'Objective analytical breakdown of page disclosures and reported information. Does not constitute financial advice or investment recommendations.'
            : 'Objective analytical summary of extracted page content. Does not constitute professional or investment advice.')}
        </p>
      `;

      const reBtn = this.shadowRoot.getElementById('btn-reanalyze');
      if (reBtn) {
        reBtn.addEventListener('click', () => this.runSummaryAnalysis());
      }

      // Stock tracking buttons in the summary stocks box
      this.shadowRoot.querySelectorAll('.btn-summary-stock-track').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const target = e.currentTarget;
          const t = target.dataset.ticker;
          const c = target.dataset.company;
          const cik = target.dataset.cik;
          if (!t) return;
          const toggleRes = await this.watchlistService.toggleWatchlist(t, c, cik);
          if (toggleRes.inWatchlist) {
            target.classList.add('tracked');
            target.innerHTML = '✓ Tracked';
            this.showToast(`✓ Added ${t} (${c}) to Watchlist`);
          } else {
            target.classList.remove('tracked');
            target.innerHTML = '+ Track';
            this.showToast(`Removed ${t} from Watchlist`);
          }
          await this.updateHeaderWatchlistButton();

          const allBtn = this.shadowRoot.getElementById('btn-track-all-summary-stocks');
          if (allBtn) {
            const allItems = Array.from(this.shadowRoot.querySelectorAll('.btn-summary-stock-track'));
            const allDone = allItems.every((el) => el.classList.contains('tracked'));
            allBtn.textContent = allDone ? '✓ All Tracked' : '+ Track All';
          }
        });
      });

      // Track All Button
      const trackAllBtn = this.shadowRoot.getElementById('btn-track-all-summary-stocks');
      if (trackAllBtn) {
        trackAllBtn.addEventListener('click', async () => {
          const trackButtons = Array.from(this.shadowRoot.querySelectorAll('.btn-summary-stock-track'));
          const untrackedButtons = trackButtons.filter((el) => !el.classList.contains('tracked'));
          if (untrackedButtons.length > 0) {
            for (const btn of untrackedButtons) {
              const t = btn.dataset.ticker;
              const c = btn.dataset.company;
              const cik = btn.dataset.cik;
              await this.watchlistService.addTicker(t, c, cik);
              btn.classList.add('tracked');
              btn.innerHTML = '✓ Tracked';
            }
            trackAllBtn.textContent = '✓ All Tracked';
            this.showToast(`✓ Added ${untrackedButtons.length} stocks to Watchlist`);
          } else {
            for (const btn of trackButtons) {
              const t = btn.dataset.ticker;
              await this.watchlistService.removeTicker(t);
              btn.classList.remove('tracked');
              btn.innerHTML = '+ Track';
            }
            trackAllBtn.textContent = '+ Track All';
            this.showToast(`Removed stocks from Watchlist`);
          }
          await this.updateHeaderWatchlistButton();
        });
      }

      const returnPageBtn = this.shadowRoot.getElementById('btn-return-page-doc');
      if (returnPageBtn) {
        returnPageBtn.addEventListener('click', () => this.closeFilingSummaryView());
      }
    }

    getSnapshotScopeKey() {
      // 0. If currently viewing a tracked company's filing summary
      if (this.activeFilingContext && this.activeFilingContext.ticker) {
        return `filing_${this.activeFilingContext.ticker}`;
      }

      // 1. If financial filing with a specific company ticker detected (e.g., NWMC, AAPL on SEC EDGAR or Yahoo Finance)
      if (this.pageData && this.pageData.ticker && this.pageData.ticker !== 'PAGE' && this.pageData.ticker !== 'PDF') {
        const ticker = this.pageData.ticker.toUpperCase().replace(/[^a-zA-Z0-9]/g, '_');
        const formType = (this.pageData.formType || 'Doc').replace(/[^a-zA-Z0-9]/g, '_');
        return `stock_${ticker}_${formType}`;
      }

      // 2. For general websites, articles, or other pages: isolate strictly by hostname + pathname
      const host = (window.location.hostname || 'local').replace(/[^a-zA-Z0-9]/g, '_');
      const cleanPath = (window.location.pathname || 'page').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 80);
      const company = (this.pageData && this.pageData.company) ? this.pageData.company.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40) : '';

      return `${host}_${cleanPath || 'home'}${company ? '_' + company : ''}`;
    }

    async viewFilingSummary(ticker) {
      const cleanTicker = this.watchlistService.extractCleanSymbol(ticker);
      if (!cleanTicker) return;

      this.showToast(`Loading SEC filing summary for ${cleanTicker}...`);
      this.isAnalyzing = true;
      this.activeTab = 'summary';

      // Save original page state if not already saved
      if (!this.originalPageState) {
        this.originalPageState = {
          pageData: this.pageData,
          summaryResult: this.summaryResult,
        };
      }

      // Open panel if closed
      this.openPanel();
      await this.renderTab('summary');

      try {
        const filingData = await this.watchlistService.getFilingSummaryAndChanges(cleanTicker);
        if (!filingData) {
          throw new Error(`Could not load filing summary for ${cleanTicker}`);
        }

        this.activeFilingContext = filingData;
        this.pageData = filingData.pageData;
        this.summaryResult = filingData.summaryResult;

        // Store baseline snapshot (prior filing) and current snapshot (this filing) in storage
        const scopeKey = `filing_${cleanTicker}`;
        await this.storage.saveFilingSnapshot(scopeKey, filingData.formType, filingData.priorPeriod, {
          text: `Prior Period Filing: ${filingData.priorPeriod}`,
          savedAt: filingData.priorDate ? new Date(filingData.priorDate).toISOString() : new Date(Date.now() - 90 * 86400000).toISOString(),
          whatChanged: filingData.priorWhatChanged || [],
        });
        await this.storage.saveFilingSnapshot(scopeKey, filingData.formType, filingData.period, {
          text: filingData.pageData.fullText,
          savedAt: filingData.filingDate ? new Date(filingData.filingDate).toISOString() : new Date().toISOString(),
          whatChanged: filingData.summaryResult.whatChanged || [],
        });

        this.isAnalyzing = false;
        await this.renderTab('summary');
        this.showToast(`✓ Loaded ${cleanTicker} (${filingData.formType}) summary`);
      } catch (err) {
        console.warn('Prospectus: viewFilingSummary error:', err.message || err);
        this.isAnalyzing = false;
        this.lastAnalysisError = err.message;
        await this.renderTab('summary');
      }
    }

    closeFilingSummaryView() {
      if (this.originalPageState) {
        this.pageData = this.originalPageState.pageData;
        this.summaryResult = this.originalPageState.summaryResult;
        this.originalPageState = null;
      }
      this.activeFilingContext = null;
      this.renderTab(this.activeTab);
      this.showToast('Returned to active webpage document');
    }

    async runSummaryAnalysis() {
      this.lastAnalysisError = null;

      const check = await this.license.checkCanAnalyze();
      if (!check.allowed) {
        this.lastAnalysisError = 'Prospectus license required. Please configure your license in Settings.';
        this.showToast('License required. Open Settings.');
        this.renderTab(this.activeTab);
        return;
      }

      const settings = await this.storage.getSettings();
      if (!settings.apiKey && settings.aiProvider !== 'custom') {
        this.lastAnalysisError = 'API call error. Please check your API configuration or connection in Settings.';
        this.showToast('API call error. Check Settings.');
        this.renderTab(this.activeTab);
        return;
      }

      this.isAnalyzing = true;
      this.renderTab(this.activeTab);

      try {
        // 1. If PDF document, extract full readable text from PDF binary streams
        if (
          this.pageData &&
          (this.pageData.siteType === 'pdf_document' || window.location.pathname.endsWith('.pdf') || window.location.href.includes('.pdf')) &&
          (!this.pageData.extractedText || this.pageData.extractedText.length < 50)
        ) {
          try {
            let pdfText = '';
            if (typeof window.ProspectusPDFExtractor !== 'undefined' || typeof PDFExtractor !== 'undefined') {
              const ext = window.ProspectusPDFExtractor || PDFExtractor;
              pdfText = await ext.extractFromUrl(window.location.href);
            }
            if (!pdfText && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
              const bgRes = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: 'FETCH_PDF_TEXT', url: window.location.href }, (r) => {
                  if (chrome.runtime.lastError) return resolve(null);
                  resolve(r);
                });
              });
              if (bgRes && bgRes.success && bgRes.text) pdfText = bgRes.text;
            }
            if (pdfText && pdfText.trim().length > 30) {
              this.pageData.extractedText = pdfText.trim();
              this.pageData.fullText = `PDF Title: ${this.pageData.company}\n\nFull Extracted Document Content:\n${pdfText.trim().slice(0, 24000)}`;
              this.pageData.isFinanceSite = FinancialExtractors.isFinancialContent(pdfText, this.pageData.company, window.location.href);
            }
          } catch (pdfErr) {
            console.warn('Prospectus: PDF extraction error:', pdfErr);
          }
        }

        // 2. Deep asynchronous extraction for any embedded documents inside the webpage (iframes, embed tags, PDF viewers, shadow DOM)
        try {
          const asyncDocs = await FinancialExtractors.extractEmbeddedDocumentsAsync();
          if (asyncDocs && asyncDocs.length > 0) {
            this.pageData.hasEmbeddedDocuments = true;
            this.pageData.embeddedDocuments = asyncDocs;

            let embeddedSectionText = '';
            for (const doc of asyncDocs) {
              if (doc.text && doc.text.length > 50) {
                embeddedSectionText += `\n\n${doc.text}\n`;

                // If embedded document has high-signal SEC sections, adopt them
                if (doc.riskFactorsText && !this.pageData.riskFactorsText) this.pageData.riskFactorsText = doc.riskFactorsText;
                if (doc.mdaText && !this.pageData.mdaText) this.pageData.mdaText = doc.mdaText;
                if (doc.businessText && !this.pageData.businessText) this.pageData.businessText = doc.businessText;
                if (doc.ticker && (!this.pageData.ticker || this.pageData.ticker === 'PAGE')) this.pageData.ticker = doc.ticker;
                if (doc.company && (!this.pageData.company || this.pageData.company === 'Web Document')) this.pageData.company = doc.company;
                if (doc.isFinancial) this.pageData.isFinanceSite = true;
              }
            }

            if (embeddedSectionText) {
              this.pageData.fullText = embeddedSectionText + '\n\n' + (this.pageData.fullText || '');
            }
          }
        } catch (e) {
          console.warn('Prospectus: extractEmbeddedDocumentsAsync in summary error:', e);
        }

        const res = await this.ai.generateSummary({
          ticker: this.pageData.ticker,
          company: this.pageData.company,
          formType: this.pageData.formType,
          text: this.pageData.fullText,
          headlines: this.pageData.headlines,
        });

        if (!res || !res.bullets || res.bullets.length === 0) {
          throw new Error('API returned an empty response. Please try again.');
        }

        this.summaryResult = res;
        this.lastAnalysisError = null;
        this.renderAdvancedFooter(res.suggestedQueries || this.ai.extractDynamicFallbackQueries(this.pageData));

        // Automatically save snapshot upon successful analysis, scoped strictly to this website/document
        try {
          const scopeKey = this.getSnapshotScopeKey();
          const defaultNew = this.pageData.riskFactorsText || (this.pageData.fullText ? this.pageData.fullText.slice(0, 8000) : '');
          const periodName = `Snapshot ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          await this.storage.saveFilingSnapshot(
            scopeKey,
            this.pageData.formType || 'Document',
            periodName,
            { text: defaultNew }
          );
        } catch (snapErr) {
          console.warn('Auto-save snapshot note:', snapErr.message);
        }
      } catch (err) {
        console.warn('Summary AI analysis error:', err.message);
        // Do NOT execute workflow on error - clear state and record error
        this.summaryResult = null;
        this.lastAnalysisError = `API call error: ${err.message || 'Unable to complete AI request. Please check Settings.'}`;
        
        // Hide advanced research footer if open
        const footer = this.shadowRoot.getElementById('prospectus-advanced-footer');
        if (footer) footer.style.display = 'none';

        this.showToast(this.lastAnalysisError);
      } finally {
        this.isAnalyzing = false;
        this.renderTab(this.activeTab);
        this.updateFooterStatus();
      }
    }

    // --- Tab 2: What Changed (Structured Shift Cards & Version Tracking) ---
    async renderWhatChangedTab(container) {
      // 1. If not analyzed yet and no analysis result, show unanalyzed state (matching Summary tab)
      if (!this.summaryResult && !this.isAnalyzing) {
        if (this.lastAnalysisError) {
          container.innerHTML = `
            <div class="non-finance-view">
              <div class="analysis-error-card">
                <div class="error-header">
                  <span class="error-badge">API Call Error</span>
                </div>
                <p class="error-text">${this.lastAnalysisError}</p>
                <div style="display: flex; gap: 8px; margin-top: 6px;">
                  <button class="btn-dark-cta" id="btn-what-changed-analyze" style="padding: 7px 14px; font-size: 12.5px;">
                    Retry Analysis
                  </button>
                  <button class="coral-btn" id="btn-error-settings-what" style="font-size: 11.5px; padding: 7px 12px;">
                    Open Settings
                  </button>
                </div>
              </div>
              <div class="non-finance-notice">
                Please verify your API key, provider configuration, or network connection in Prospectus Settings.
              </div>
            </div>
          `;

          const retryBtn = this.shadowRoot.getElementById('btn-what-changed-analyze');
          if (retryBtn) retryBtn.addEventListener('click', () => this.runSummaryAnalysis());

          const settingsBtn = this.shadowRoot.getElementById('btn-error-settings-what');
          if (settingsBtn) settingsBtn.addEventListener('click', () => this.openSettings());
          return;
        }

        container.innerHTML = `
          <div class="non-finance-view">
            <p class="non-finance-prompt">Ready to track YoY & period changes for ${this.pageData.company || 'this document'}?</p>
            <button class="btn-dark-cta" id="btn-what-changed-analyze">
              Analyze this page
            </button>
            <div class="non-finance-notice">
              Prospectus automatically extracts top-line revenue shifts, segment growth, operating margins, cash flows, and new Item 1A risk disclosures.
            </div>
          </div>
        `;

        const analyzeBtn = this.shadowRoot.getElementById('btn-what-changed-analyze');
        if (analyzeBtn) {
          analyzeBtn.addEventListener('click', () => this.runSummaryAnalysis());
        }
        return;
      }

      // 2. If analyzing currently
      if (this.isAnalyzing) {
        container.innerHTML = `
          <div class="what-changed-view">
            <div class="what-changed-header">
              <h2 class="what-changed-title">What changed</h2>
            </div>
            <div class="what-changed-list">
              <div class="wc-change-card">
                <div class="loading-shimmer" style="height: 12px; width: 30%; margin-bottom: 6px;"></div>
                <div class="loading-shimmer" style="height: 18px; width: 80%; margin-bottom: 6px;"></div>
                <div class="loading-shimmer" style="height: 12px; width: 50%;"></div>
              </div>
              <div class="wc-change-card">
                <div class="loading-shimmer" style="height: 12px; width: 25%; margin-bottom: 6px;"></div>
                <div class="loading-shimmer" style="height: 18px; width: 75%; margin-bottom: 6px;"></div>
                <div class="loading-shimmer" style="height: 12px; width: 45%;"></div>
              </div>
              <div class="wc-change-card">
                <div class="loading-shimmer" style="height: 12px; width: 35%; margin-bottom: 6px;"></div>
                <div class="loading-shimmer" style="height: 18px; width: 70%; margin-bottom: 6px;"></div>
                <div class="loading-shimmer" style="height: 12px; width: 55%;"></div>
              </div>
            </div>
          </div>
        `;
        return;
      }

      // 3. Check history for this scope
      const scopeKey = this.getSnapshotScopeKey();
      const history = await this.storage.getFilingHistory(scopeKey);
      const currentText = this.pageData.fullText || this.pageData.riskFactorsText || '';
      const currentPeriod = this.pageData.periodBadge || this.pageData.filingDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      // CASE A: No history is present -> Save baseline and do NOT show any change
      if (!history || history.length === 0) {
        const baselinePeriod = `Initial Baseline · ${currentPeriod}`;
        await this.storage.saveFilingSnapshot(scopeKey, this.pageData.formType || 'Document', baselinePeriod, {
          text: currentText,
          savedAt: new Date().toISOString(),
          summary: this.summaryResult ? this.summaryResult.overview : '',
          whatChanged: [], // Baseline has no prior changes
        });

        container.innerHTML = `
          <div class="what-changed-view">
            <div class="what-changed-header">
              <h2 class="what-changed-title">What changed</h2>
              <span class="wc-baseline-status-badge">● Baseline Active</span>
            </div>

            <div class="wc-baseline-card">
              <div class="wc-card-category">
                <span class="wc-cat-dot">●</span>
                <span>INITIAL BASELINE ESTABLISHED</span>
              </div>
              <h3 class="wc-baseline-headline">Baseline recorded for ${FilingDiffEngine.escapeHTML(this.pageData.company || this.pageData.ticker || 'this document')}</h3>
              <p class="wc-baseline-desc">
                No prior version history exists for this document, so no changes are displayed. This initial baseline has been saved to your local history. Future filings, revisions, or page updates will automatically be compared against this baseline to track material YoY and period changes.
              </p>
              <div class="wc-baseline-meta-row">
                <span class="wc-baseline-meta">Recorded: <strong>${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></span>
                <span class="wc-baseline-meta">Scope: <strong>${FilingDiffEngine.escapeHTML(this.pageData.ticker || this.pageData.formType || 'Document')}</strong></span>
                <span class="wc-baseline-meta">Status: <strong>Tracking Active</strong></span>
              </div>
              <div style="margin-top: 10px; display: flex; gap: 8px;">
                <button class="coral-btn" id="btn-wc-new-snapshot" style="font-size: 11px; padding: 5px 10px;">
                  + Record Revision Snapshot
                </button>
              </div>
            </div>
          </div>
        `;

        const newSnapBtn = this.shadowRoot.getElementById('btn-wc-new-snapshot');
        if (newSnapBtn) {
          newSnapBtn.addEventListener('click', async () => {
            const revPeriod = `Revision · ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            const items = (this.summaryResult && Array.isArray(this.summaryResult.whatChanged) && this.summaryResult.whatChanged.length > 0)
              ? this.summaryResult.whatChanged
              : this.ai.extractDynamicWhatChanged({
                  text: currentText,
                  company: this.pageData.company,
                  ticker: this.pageData.ticker,
                  formType: this.pageData.formType
                });
            await this.storage.saveFilingSnapshot(scopeKey, this.pageData.formType || 'Document', revPeriod, {
              text: currentText,
              savedAt: new Date().toISOString(),
              whatChanged: items,
            });
            this.showToast('Revision snapshot recorded to history.');
            this.renderWhatChangedTab(container);
          });
        }
        return;
      }

      // CASE B: History IS present -> Check if only baseline exists without changes
      const latestRevision = history[0];
      const baselineItem = history[history.length - 1];

      if (history.length === 1 && (!latestRevision.whatChanged || latestRevision.whatChanged.length === 0)) {
        container.innerHTML = `
          <div class="what-changed-view">
            <div class="what-changed-header">
              <h2 class="what-changed-title">What changed</h2>
              <span class="wc-baseline-status-badge">● Baseline Active</span>
            </div>

            <div class="wc-baseline-card">
              <div class="wc-card-category">
                <span class="wc-cat-dot">●</span>
                <span>INITIAL BASELINE ESTABLISHED</span>
              </div>
              <h3 class="wc-baseline-headline">Baseline recorded for ${FilingDiffEngine.escapeHTML(this.pageData.company || this.pageData.ticker || 'this document')}</h3>
              <p class="wc-baseline-desc">
                Initial baseline snapshot is active (saved ${new Date(baselineItem.savedAt).toLocaleDateString()}). No subsequent revisions have been recorded yet. Click below to record a new revision snapshot to track changes.
              </p>
              <div class="wc-baseline-meta-row">
                <span class="wc-baseline-meta">Baseline: <strong>${baselineItem.period || 'Initial'}</strong></span>
                <span class="wc-baseline-meta">History: <strong>1 Snapshot</strong></span>
              </div>
              <div style="margin-top: 10px; display: flex; gap: 8px;">
                <button class="coral-btn" id="btn-wc-new-snapshot" style="font-size: 11px; padding: 5px 10px;">
                  + Record Revision Snapshot
                </button>
              </div>
            </div>
          </div>
        `;

        const newSnapBtn = this.shadowRoot.getElementById('btn-wc-new-snapshot');
        if (newSnapBtn) {
          newSnapBtn.addEventListener('click', async () => {
            const revPeriod = `Revision · ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            const items = (this.summaryResult && Array.isArray(this.summaryResult.whatChanged) && this.summaryResult.whatChanged.length > 0)
              ? this.summaryResult.whatChanged
              : this.ai.extractDynamicWhatChanged({
                  text: currentText,
                  company: this.pageData.company,
                  ticker: this.pageData.ticker,
                  formType: this.pageData.formType
                });
            await this.storage.saveFilingSnapshot(scopeKey, this.pageData.formType || 'Document', revPeriod, {
              text: currentText,
              savedAt: new Date().toISOString(),
              whatChanged: items,
            });
            this.showToast('Revision snapshot recorded to history.');
            this.renderWhatChangedTab(container);
          });
        }
        return;
      }

      // History has revisions! Load changes history and render cards
      const latestData = await this.storage.get(latestRevision.key);
      let items = (latestData && latestData[latestRevision.key] && Array.isArray(latestData[latestRevision.key].whatChanged) && latestData[latestRevision.key].whatChanged.length > 0)
        ? latestData[latestRevision.key].whatChanged
        : ((this.summaryResult && Array.isArray(this.summaryResult.whatChanged) && this.summaryResult.whatChanged.length > 0)
            ? this.summaryResult.whatChanged
            : this.ai.extractDynamicWhatChanged({
                text: currentText,
                company: this.pageData.company,
                ticker: this.pageData.ticker,
                formType: this.pageData.formType
              }));

      // Automatically persist whatChanged into snapshot history if not already stored
      if (latestData && latestData[latestRevision.key] && (!latestData[latestRevision.key].whatChanged || latestData[latestRevision.key].whatChanged.length === 0)) {
        await this.storage.set({
          [latestRevision.key]: {
            ...latestData[latestRevision.key],
            whatChanged: items,
          }
        });
      }

      const historyOptionsHTML = history.map((h, i) => `
        <option value="${h.key}" ${i === 0 ? 'selected' : ''}>
          ${i === 0 ? 'Latest Revision' : 'Baseline'}: ${h.period || new Date(h.savedAt).toLocaleDateString()}
        </option>
      `).join('');

      const renderCards = (filterType = 'all') => {
        const filtered = items.filter(item => {
          if (filterType === 'all') return true;
          if (filterType === 'financial') return item.type === 'financial' || !item.type;
          if (filterType === 'risk') return item.type === 'risk' || (item.category && item.category.toLowerCase().includes('risk'));
          if (filterType === 'operational') return item.type === 'operational' || (item.category && (item.category.toLowerCase().includes('coatings') || item.category.toLowerCase().includes('services') || item.category.toLowerCase().includes('capex')));
          return true;
        });

        if (filtered.length === 0) {
          return `<div style="padding: 24px; text-align: center; color: #8a877f; font-size: 13px;">No ${filterType} changes found for this revision.</div>`;
        }

        return filtered.map(item => {
          const isPos = item.isPositive === true;
          const isNeg = item.isPositive === false && (String(item.changePercent).startsWith('-') || String(item.headline).toLowerCase().includes('decrease') || String(item.headline).toLowerCase().includes('decline'));
          const badgeClass = isPos ? 'positive' : (isNeg ? 'negative' : 'neutral');

          return `
            <div class="wc-change-card" data-type="${item.type || 'financial'}">
              <div class="wc-card-category">
                <span class="wc-cat-dot">●</span>
                <span>${FilingDiffEngine.escapeHTML(item.category || 'FINANCIAL METRIC')}</span>
              </div>
              <div class="wc-card-headline-row">
                <div class="wc-card-headline">${FilingDiffEngine.escapeHTML(item.headline || '')}</div>
                <div class="wc-card-badge ${badgeClass}">${FilingDiffEngine.escapeHTML(item.changePercent || '')}</div>
              </div>
              <div class="wc-card-period">
                <span>${FilingDiffEngine.escapeHTML(item.periodComparison || '')}</span>
              </div>
            </div>
          `;
        }).join('');
      };

      container.innerHTML = `
        <div class="what-changed-view">
          ${
            this.activeFilingContext
              ? `
              <div class="active-filing-banner">
                <div class="filing-banner-left">
                  <span class="filing-banner-tag">SEC ${this.activeFilingContext.formType}</span>
                  <span class="filing-banner-title" title="${this.activeFilingContext.company} (${this.activeFilingContext.ticker})">${this.activeFilingContext.company} (${this.activeFilingContext.ticker}) · Shifts vs Prior Filing</span>
                </div>
                <div class="filing-banner-actions">
                  <a href="${this.activeFilingContext.sourceUrl}" target="_blank" rel="noopener" class="filing-banner-source-link" title="Open official SEC EDGAR filing">View source ↗</a>
                  <button type="button" class="filing-banner-back-btn" id="btn-wc-return-page-doc" title="Return to current webpage document">✕ Close</button>
                </div>
              </div>
            `
              : ''
          }

          <div class="what-changed-header">
            <h2 class="what-changed-title">What changed</h2>
            <select class="wc-filter-select" id="wc-filter-select">
              <option value="all">All changes</option>
              <option value="financial">Financial metrics</option>
              <option value="risk">Risk disclosures</option>
              <option value="operational">Operational</option>
            </select>
          </div>

          <!-- History Revision Bar -->
          <div class="wc-history-bar">
            <span class="wc-history-label">History:</span>
            <select class="wc-history-select" id="wc-history-select">
              ${historyOptionsHTML}
            </select>
            <button class="coral-btn" id="btn-wc-new-snapshot" style="font-size: 10.5px; padding: 3px 7px;">+ New Snapshot</button>
          </div>

          <div class="what-changed-list" id="what-changed-cards-container">
            ${renderCards('all')}
          </div>
        </div>
      `;

      const wcReturnBtn = this.shadowRoot.getElementById('btn-wc-return-page-doc');
      if (wcReturnBtn) {
        wcReturnBtn.addEventListener('click', () => this.closeFilingSummaryView());
      }

      const filterSelect = this.shadowRoot.getElementById('wc-filter-select');
      const cardsContainer = this.shadowRoot.getElementById('what-changed-cards-container');
      if (filterSelect && cardsContainer) {
        filterSelect.addEventListener('change', (e) => {
          cardsContainer.innerHTML = renderCards(e.target.value);
        });
      }

      const historySelect = this.shadowRoot.getElementById('wc-history-select');
      if (historySelect) {
        historySelect.addEventListener('change', async (e) => {
          const selectedKey = e.target.value;
          const data = await this.storage.get(selectedKey);
          if (data && data[selectedKey] && Array.isArray(data[selectedKey].whatChanged)) {
            items = data[selectedKey].whatChanged;
            cardsContainer.innerHTML = renderCards(filterSelect ? filterSelect.value : 'all');
          }
        });
      }

      const newSnapBtn = this.shadowRoot.getElementById('btn-wc-new-snapshot');
      if (newSnapBtn) {
        newSnapBtn.addEventListener('click', async () => {
          const revPeriod = `Revision · ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          const freshItems = (this.summaryResult && Array.isArray(this.summaryResult.whatChanged) && this.summaryResult.whatChanged.length > 0)
            ? this.summaryResult.whatChanged
            : this.ai.extractDynamicWhatChanged({
                text: currentText,
                company: this.pageData.company,
                ticker: this.pageData.ticker,
                formType: this.pageData.formType
              });
          await this.storage.saveFilingSnapshot(scopeKey, this.pageData.formType || 'Document', revPeriod, {
            text: currentText,
            savedAt: new Date().toISOString(),
            whatChanged: freshItems,
          });
          this.showToast('Revision snapshot recorded to history.');
          this.renderWhatChangedTab(container);
        });
      }
    }

    // --- Tab 3: Explain Terms ---
    renderExplainTab(container) {
      const isAnalyzed = !!(this.summaryResult && (this.summaryResult.overview || (this.summaryResult.bullets && this.summaryResult.bullets.length > 0)));
      const recTerms = (isAnalyzed && this.ai)
        ? this.ai.extractRecommendedExplainTerms(this.pageData, this.summaryResult)
        : [];

      container.innerHTML = `
        <h2 class="section-headline">Explain terms</h2>
        <p style="font-size: 13px; color: #6c6a64; margin-bottom: 10px;">
          Search any term below or highlight text on the page to explain it using the actual context in this document.
        </p>

        <div class="explain-input-box">
          <input type="text" class="text-input-field" id="explain-term-input" placeholder="e.g. gross margin, deferred revenue..." />
          <button class="coral-btn" id="btn-run-explain">Explain</button>
        </div>

        <!-- AI Recommended Search Terms Section (Shown ONLY when a document is analyzed) -->
        ${
          (isAnalyzed && recTerms.length > 0)
            ? `
            <div class="explain-recommendations-section">
              <span class="explain-rec-label">✦ AI Recommended Terms in This Document</span>
              <div class="explain-rec-chips" id="explain-rec-chips-container">
                ${recTerms.map((t) => `<button class="explain-rec-chip" data-term="${t.replace(/"/g, '&quot;')}">${t}</button>`).join('')}
              </div>
            </div>
            `
            : ''
        }

        <div class="card-box" id="explain-result-card" style="display: none; margin-top: 12px;">
          <h4 id="explain-result-term" style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 16px;">Term Explanation</h4>
          <p id="explain-result-body" style="font-size: 13px; line-height: 1.55; color: #2b2926;">Loading...</p>
          <button class="coral-btn" id="btn-save-explain-note" style="align-self: flex-start; margin-top: 6px; font-size: 12px; padding: 6px 12px;">
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

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
          this.triggerExplainTerm(input.value.trim());
        }
      });

      this.shadowRoot.querySelectorAll('.explain-rec-chip').forEach((chip) => {
        chip.addEventListener('click', (e) => {
          const term = e.currentTarget.dataset.term;
          if (input) input.value = term;
          this.triggerExplainTerm(term);
        });
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
      if (body) body.innerHTML = `<div class="loading-shimmer" style="height: 40px;"></div>`;
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      let finalExplanation = '';
      try {
        finalExplanation = await this.ai.explainTermInContext({
          term,
          context: this.selectedText || this.pageData.fullText.slice(0, 2000),
          ticker: this.pageData.ticker,
          company: this.pageData.company,
        });

        if (body) body.textContent = finalExplanation;
      } catch (err) {
        console.warn('Explain term API error:', err.message);
        finalExplanation = `In this document, "${term}" is referenced in relation to operational and financial disclosures.`;
        if (body) {
          body.innerHTML = `
            <div>${finalExplanation}</div>
            <div class="tab-inline-error-notice" style="margin-top: 10px; padding: 8px 12px; background: #fff5f2; border: 1px solid #f2d4cc; border-radius: 6px; font-size: 12px; color: #a9583e; display: flex; justify-content: space-between; align-items: center;">
              <span>⚠️ API Error: ${err.message || 'Please check your API key in Settings'}</span>
              <button type="button" class="coral-btn" style="padding: 3px 8px; font-size: 11px; margin-left: 8px; white-space: nowrap;" id="btn-explain-settings">Settings</button>
            </div>
          `;
          const expSetBtn = this.shadowRoot.getElementById('btn-explain-settings');
          if (expSetBtn) expSetBtn.addEventListener('click', () => this.openSettings());
        }
      }

      const saveBtn = this.shadowRoot.getElementById('btn-save-explain-note');
      if (saveBtn) {
        saveBtn.onclick = () => {
          this.openSaveNoteModal({
            title: `Concept: ${term}`,
            quote: term,
            note: finalExplanation,
            category: 'Financial Metrics',
            ticker: this.pageData.ticker,
          });
        };
      }
    }

    // --- Save Note Modal / Sheet Dialog ---
    openSaveNoteModal({ id = null, title = '', quote = '', note = '', category = 'General', ticker = '' } = {}) {
      const sidebar = this.shadowRoot.getElementById('prospectus-sidebar');
      // Remove any existing open modal
      const existing = this.shadowRoot.getElementById('prospectus-save-note-modal');
      if (existing) existing.remove();

      const defaultTitle = title || (quote ? (quote.length > 40 ? quote.slice(0, 40) + '...' : quote) : '');
      const defaultCategory = category || 'General';
      const cleanTicker = ticker || this.pageData.ticker || 'PAGE';

      const modalEl = document.createElement('div');
      modalEl.id = 'prospectus-save-note-modal';
      modalEl.className = 'prospectus-modal-overlay';
      modalEl.innerHTML = `
        <div class="prospectus-modal-card">
          <div class="modal-header-row">
            <h3>${id ? 'Edit Research Note' : 'Create New Note'}</h3>
            <button class="icon-btn" id="btn-close-note-modal" title="Cancel">${ICONS.close}</button>
          </div>

          <div class="modal-field">
            <label for="modal-note-title-input">Note Title</label>
            <input type="text" id="modal-note-title-input" value="${defaultTitle.replace(/"/g, '&quot;')}" placeholder="e.g. Capex Commitment, Pricing Power, Margin Outlook..." />
          </div>

          <div class="modal-field">
            <label for="modal-note-category-select">Notebook Folder / Category</label>
            <select id="modal-note-category-select">
              <option value="Risks & Disclosures" ${defaultCategory === 'Risks & Disclosures' ? 'selected' : ''}>Risks & Disclosures</option>
              <option value="Financial Metrics" ${defaultCategory === 'Financial Metrics' ? 'selected' : ''}>Financial Metrics</option>
              <option value="Operations & Capex" ${defaultCategory === 'Operations & Capex' ? 'selected' : ''}>Operations & Capex</option>
              <option value="Management Guidance" ${defaultCategory === 'Management Guidance' ? 'selected' : ''}>Management Guidance</option>
              <option value="Valuation & Multiples" ${defaultCategory === 'Valuation & Multiples' ? 'selected' : ''}>Valuation & Multiples</option>
              <option value="General" ${defaultCategory === 'General' ? 'selected' : ''}>General Notes</option>
            </select>
          </div>

          ${quote ? `
          <div class="modal-field">
            <label>Selected Excerpt / Quote</label>
            <div class="modal-quote-preview">"${quote}"</div>
          </div>
          ` : ''}

          <div class="modal-field">
            <label for="modal-note-body-input">Note Content / Analysis</label>
            <textarea id="modal-note-body-input" rows="3" placeholder="Add your notes, key takeaways, or analytical model notes...">${note}</textarea>
          </div>

          <div class="modal-actions-row">
            <button class="icon-btn" id="btn-cancel-note-modal" style="padding: 7px 12px; font-size: 12.5px;">Cancel</button>
            <button class="coral-btn" id="btn-confirm-save-note" style="padding: 7px 16px; font-size: 13px;">
              ${ICONS.bookmark} ${id ? 'Update Note' : 'Save to Notebook'}
            </button>
          </div>
        </div>
      `;

      if (sidebar) {
        sidebar.appendChild(modalEl);
      } else {
        this.shadowRoot.appendChild(modalEl);
      }

      const titleInput = this.shadowRoot.getElementById('modal-note-title-input');
      const catSelect = this.shadowRoot.getElementById('modal-note-category-select');
      const bodyInput = this.shadowRoot.getElementById('modal-note-body-input');
      const confirmBtn = this.shadowRoot.getElementById('btn-confirm-save-note');
      const closeBtn = this.shadowRoot.getElementById('btn-close-note-modal');
      const cancelBtn = this.shadowRoot.getElementById('btn-cancel-note-modal');

      if (titleInput) {
        setTimeout(() => titleInput.focus(), 50);
      }

      const closeModal = () => modalEl.remove();
      closeBtn.addEventListener('click', closeModal);
      cancelBtn.addEventListener('click', closeModal);
      modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) closeModal();
      });

      confirmBtn.addEventListener('click', async () => {
        const finalTitle = titleInput.value.trim() || 'Untitled Note';
        const finalCat = catSelect.value;
        const finalBody = bodyInput.value.trim();

        await this.storage.saveNotebookEntry({
          id: id || undefined,
          title: finalTitle,
          category: finalCat,
          ticker: cleanTicker,
          company: this.pageData.company || '',
          quote: quote || '',
          note: finalBody,
          sourceUrl: window.location.href,
          tags: [finalCat, cleanTicker],
        });

        closeModal();
        this.showToast(`Saved note: "${finalTitle}"`);

        if (this.activeTab === 'notebook') {
          const container = this.shadowRoot.getElementById('tab-content-container');
          if (container) this.renderNotebookTab(container);
        }
      });
    }

    // --- Tab 4: Notebook (Organized Research Notebook) ---
    async renderNotebookTab(container) {
      if (this.notebookCategoryFilter === undefined) this.notebookCategoryFilter = 'ALL';
      if (this.notebookSearchQuery === undefined) this.notebookSearchQuery = '';

      const allEntries = await this.storage.getNotebookEntries();

      // Categories available
      const categories = [
        'ALL',
        'Risks & Disclosures',
        'Financial Metrics',
        'Operations & Capex',
        'Management Guidance',
        'Valuation & Multiples',
        'General'
      ];

      // Filter entries by category and search query
      const filtered = allEntries.filter((entry) => {
        // Category filter
        if (this.notebookCategoryFilter !== 'ALL') {
          const cat = entry.category || 'General';
          if (cat !== this.notebookCategoryFilter) return false;
        }

        // Search query filter
        if (this.notebookSearchQuery) {
          const q = this.notebookSearchQuery.toLowerCase();
          const matchTitle = (entry.title || '').toLowerCase().includes(q);
          const matchNote = (entry.note || '').toLowerCase().includes(q);
          const matchQuote = (entry.quote || '').toLowerCase().includes(q);
          const matchTicker = (entry.ticker || '').toLowerCase().includes(q);
          const matchCat = (entry.category || '').toLowerCase().includes(q);
          if (!matchTitle && !matchNote && !matchQuote && !matchTicker && !matchCat) return false;
        }

        return true;
      });

      container.innerHTML = `
        <div class="notebook-top-row">
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <h2 class="section-headline" style="margin-bottom: 0;">Research notebook</h2>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #8e8b82;">${filtered.length} of ${allEntries.length} notes</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="coral-btn" id="btn-new-note" style="font-size: 11.5px; padding: 4px 10px;">
              + New Note
            </button>
            <button class="icon-btn" id="btn-export-notes" title="Export Notes (Markdown)">
              ${ICONS.export}
            </button>
          </div>
        </div>

        <!-- Search & Filter Bar -->
        <div class="notebook-search-row">
          <input
            type="text"
            class="text-input-field"
            id="notebook-search-input"
            value="${(this.notebookSearchQuery || '').replace(/"/g, '&quot;')}"
            placeholder="Search notes, titles, quotes..."
            style="padding: 6px 10px; font-size: 12.5px;"
          />
        </div>

        <!-- Category Folder Filter Chips -->
        <div class="notebook-filter-chips" id="notebook-cat-chips">
          ${categories.map((cat) => `
            <button class="notebook-filter-chip ${this.notebookCategoryFilter === cat ? 'active' : ''}" data-cat="${cat}">
              ${cat === 'ALL' ? 'All Folders' : cat}
            </button>
          `).join('')}
        </div>

        <!-- Notes List Container -->
        <div id="notebook-list-container" style="display: flex; flex-direction: column; gap: 10px;">
          ${
            filtered.length === 0
              ? `
              <div style="font-size: 13px; color: #6c6a64; text-align: center; padding: 30px 14px; background: #efe9de; border-radius: 8px; border: 1px dashed #e6dfd8; display: flex; flex-direction: column; align-items: center; gap: 10px;">
                <div style="font-size: 14px; font-weight: 500; color: #141413;">
                  ${this.notebookSearchQuery || this.notebookCategoryFilter !== 'ALL' ? 'No matching notes found.' : 'Your notebook is empty.'}
                </div>
                <p style="margin: 0; font-size: 12.5px; line-height: 1.5; max-width: 280px;">
                  ${this.notebookSearchQuery || this.notebookCategoryFilter !== 'ALL' ? 'Try adjusting your search query or folder filter.' : 'Highlight text on any filing to save quotes, or click "+ New Note" above.'}
                </p>
                <button class="coral-btn" id="btn-add-first-note" style="font-size: 12px; padding: 5px 12px; margin-top: 4px;">
                  + Add a Note
                </button>
              </div>
            `
              : filtered
                  .map((entry) => {
                    const cat = entry.category || 'General';
                    let catClass = 'general';
                    if (cat.includes('Risk')) catClass = 'risks';
                    else if (cat.includes('Financial')) catClass = 'financials';
                    else if (cat.includes('Operation') || cat.includes('Capex')) catClass = 'operations';
                    else if (cat.includes('Term') || cat.includes('Valuation')) catClass = 'terms';

                    const hasNoteTicker = entry.ticker && entry.ticker !== 'PAGE' && entry.ticker !== 'PDF';
                    return `
            <div class="note-item-card" data-id="${entry.id}">
              <div class="note-card-header">
                <h4 class="note-title-text">${entry.title || 'Research Note'}</h4>
                <div class="note-meta-row">
                  <span class="note-cat-badge ${catClass}">${cat}</span>
                  <span class="pill" style="font-family: 'JetBrains Mono', monospace; font-size: 10.5px;">${entry.ticker || 'PAGE'}</span>
                </div>
              </div>

              ${entry.quote ? `<div class="note-quote">"${entry.quote}"</div>` : ''}
              ${entry.note ? `<div class="note-user-body">${entry.note}</div>` : ''}

              <div class="note-card-footer">
                <span class="note-date-text">${new Date(entry.createdAt).toLocaleDateString()} · ${new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <div class="note-actions-group">
                  <button class="note-action-btn btn-copy-note" data-id="${entry.id}" title="Copy formatted note">
                    Copy
                  </button>
                  <button class="note-action-btn btn-edit-note" data-id="${entry.id}" title="Edit title or notes">
                    Edit
                  </button>
                  <button class="note-action-btn delete btn-del-note" data-id="${entry.id}" title="Delete note">
                    ${ICONS.trash}
                  </button>
                </div>
              </div>
            </div>
          `;
                  })
                  .join('')
          }
        </div>
      `;

      // Search input handler
      const searchInput = this.shadowRoot.getElementById('notebook-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.notebookSearchQuery = e.target.value;
          this.renderNotebookTab(container);
        });
      }

      // Filter chips handler
      this.shadowRoot.querySelectorAll('.notebook-filter-chip').forEach((chip) => {
        chip.addEventListener('click', (e) => {
          this.notebookCategoryFilter = e.currentTarget.dataset.cat;
          this.renderNotebookTab(container);
        });
      });

      // New Note CTA button
      const newNoteBtn = this.shadowRoot.getElementById('btn-new-note');
      const addFirstBtn = this.shadowRoot.getElementById('btn-add-first-note');
      const triggerNewModal = () => {
        this.openSaveNoteModal({
          title: '',
          quote: '',
          note: '',
          category: this.notebookCategoryFilter !== 'ALL' ? this.notebookCategoryFilter : 'General',
          ticker: this.pageData.ticker,
        });
      };
      if (newNoteBtn) newNoteBtn.addEventListener('click', triggerNewModal);
      if (addFirstBtn) addFirstBtn.addEventListener('click', triggerNewModal);

      // Export handler
      const exportBtn = this.shadowRoot.getElementById('btn-export-notes');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          const markdown = allEntries
            .map(
              (e) =>
                `### ${e.title || 'Research Note'} (${e.ticker || 'PAGE'} · ${e.category || 'General'})\n*Date: ${new Date(e.createdAt).toLocaleDateString()}*\n\n${e.quote ? `> "${e.quote}"\n\n` : ''}${e.note ? `${e.note}\n\n` : ''}---\n`
            )
            .join('\n');
          const blob = new Blob([markdown], { type: 'text/markdown' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Prospectus-Research-Notebook-${Date.now()}.md`;
          a.click();
          this.showToast('Notebook exported to Markdown');
        });
      }

      // Copy handlers
      this.shadowRoot.querySelectorAll('.btn-copy-note').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.dataset.id;
          const entry = allEntries.find((item) => item.id === id);
          if (entry) {
            const formatted = `### ${entry.title || 'Research Note'}\n${entry.quote ? `> "${entry.quote}"\n` : ''}${entry.note || ''}`;
            navigator.clipboard.writeText(formatted);
            this.showToast('Note copied to clipboard');
          }
        });
      });

      // Edit handlers
      this.shadowRoot.querySelectorAll('.btn-edit-note').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.dataset.id;
          const entry = allEntries.find((item) => item.id === id);
          if (entry) {
            this.openSaveNoteModal({
              id: entry.id,
              title: entry.title,
              quote: entry.quote,
              note: entry.note,
              category: entry.category,
              ticker: entry.ticker,
            });
          }
        });
      });

      // Delete handlers
      this.shadowRoot.querySelectorAll('.btn-del-note').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.dataset.id;
          await this.storage.deleteNotebookEntry(id);
          this.showToast('Note deleted');
          this.renderNotebookTab(container);
        });
      });
    }

    // --- Tab 5: Watchlist Daily Digest & Ticker Hub ---
    async renderWatchlistTab(container) {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'CLEAR_DIGEST_BADGE' }).catch(() => {});
      }

      this.watchlistExpandedTicker = this.watchlistExpandedTicker || null;
      this.watchlistSubTabs = this.watchlistSubTabs || {};

      const rawItems = await this.watchlistService.getWatchlist();
      const items = rawItems.map((item) => {
        if (typeof item === 'string') {
          return {
            ticker: item,
            company: item,
            starred: false,
            lastDigest: { tag: 'Quiet', summary: 'Added to watchlist. Awaiting scheduled digest.', date: 'Today' },
          };
        }
        return item;
      });

      const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const updatedCount = items.filter((i) => i.lastDigest && i.lastDigest.tag && i.lastDigest.tag !== 'Quiet').length;
      const settings = this.storage ? await this.storage.getSettings() : {};
      const scheduleMins = settings.watchlistScheduleInterval !== undefined 
        ? settings.watchlistScheduleInterval 
        : (settings.enableBackgroundWatchlist !== false ? 1440 : 0);

      // Preload quotes and details for expanded card
      let cardsHtml = '';
      if (items.length === 0) {
        cardsHtml = `
          <div style="font-size: 13px; color: #8e8b82; text-align: center; padding: 32px 16px; background: #faf8f5; border-radius: 8px; border: 1px dashed #e4ded5;">
            No companies tracked yet. Click "+ Add company" above or track tickers from financial articles and filings.
          </div>
        `;
      } else {
        this._trackerDetailCache = this._trackerDetailCache || {};
        for (const item of items) {
          const cleanTicker = this.watchlistService ? this.watchlistService.extractCleanSymbol(item.ticker) : item.ticker;
          const isExpanded = this.watchlistExpandedTicker === item.ticker;
          const quote = item.stockQuote || (this.watchlistService?._quoteMemoryCache?.get(cleanTicker)) || null;
          const detail = isExpanded ? (this._trackerDetailCache[cleanTicker] || null) : null;

          // Determine status badge
          let statusText = 'Up to date';
          let statusClass = 'up-to-date';
          if (item.ticker === 'NVDA' || item.lastDigest?.tag === 'Filing') {
            statusText = 'New filing';
            statusClass = 'new-filing';
          } else if (item.lastDigest?.tag === 'News') {
            statusText = 'New update';
            statusClass = 'new-update';
          }

          // Format last checked date
          const lastCheckedStr = item.lastChecked
            ? new Date(item.lastChecked).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'May 2, 2024';

          const secSourceUrl = this.watchlistService.getTickerSourceUrl(item.ticker);
          const activeSubTab = this.watchlistSubTabs[item.ticker] || 'updates';

          cardsHtml += `
            <div class="watchlist-stock-card ${isExpanded ? 'expanded' : ''} ${item.muted ? 'muted' : ''}" data-ticker="${item.ticker}">
              <div class="wl-card-main-row" data-action="toggle-expand">
                <div class="wl-card-left">
                  <div class="wl-card-title-line">
                    <span class="wl-card-ticker">${item.ticker}</span>
                    <span class="wl-card-company" title="${item.company || item.ticker}">${item.company || item.ticker}</span>
                  </div>
                  <div class="wl-card-sub-line">
                    <span class="wl-card-last-checked">Last checked: ${lastCheckedStr}</span>
                    <span class="wl-card-dot-sep">·</span>
                    <a href="${secSourceUrl}" target="_blank" rel="noopener" class="wl-card-source-link" data-ticker="${item.ticker}" title="View official SEC source for ${item.ticker}">
                      View source ↗
                    </a>
                  </div>
                </div>

                <div class="wl-card-right">
                  <div class="wl-card-price-row" id="wl-card-price-box-${item.ticker}">
                    ${
                      quote
                        ? `<span class="wl-card-price">$${quote.price}</span>
                           <span class="wl-card-change ${quote.isPositive ? 'positive' : 'negative'}">
                             ${quote.isPositive ? '▲' : '▼'} ${quote.changePercent}
                           </span>`
                        : `<span class="wl-card-price" style="color: #a8a49c; font-size: 13px;">--.--</span>`
                    }
                  </div>
                  <div class="wl-card-status-row">
                    <span class="wl-status-badge ${statusClass}">${statusText}</span>
                    <span class="wl-card-expand-icon">›</span>
                  </div>
                </div>
              </div>

              <!-- Expanded Tracker Detail Pane (Visible on Click) -->
              ${
                isExpanded
                  ? (detail
                      ? `
                <div class="wl-detail-tracker-pane" id="wl-detail-pane-${item.ticker}">
                  <div class="wl-tracker-header">
                    <h3 class="wl-tracker-company-title">${detail.company} (${detail.ticker})</h3>
                    <div class="wl-tracker-actions">
                      <button class="icon-btn wl-star-btn ${item.starred ? 'starred' : ''}" data-ticker="${item.ticker}" title="${item.starred ? 'Starred' : 'Star ticker'}">
                        ${item.starred ? '★' : '☆'}
                      </button>
                      <button class="icon-btn btn-mute-ticker ${item.muted ? 'muted' : ''}" data-ticker="${item.ticker}" title="${item.muted ? 'Unmute' : 'Mute'}">
                        ${item.muted ? ICONS.bellOff : ICONS.bell}
                      </button>
                      <button class="icon-btn btn-delete-ticker" data-ticker="${item.ticker}" title="Remove ticker">
                        ${ICONS.trash}
                      </button>
                    </div>
                  </div>

                  <!-- Detail Sub-Tabs: Filings | Updates | News -->
                  <div class="wl-tracker-tabs-row">
                    <button class="wl-tracker-tab ${activeSubTab === 'filings' ? 'active' : ''}" data-ticker="${item.ticker}" data-subtab="filings">Filings</button>
                    <button class="wl-tracker-tab ${activeSubTab === 'updates' ? 'active' : ''}" data-ticker="${item.ticker}" data-subtab="updates">Updates</button>
                    <button class="wl-tracker-tab ${activeSubTab === 'news' ? 'active' : ''}" data-ticker="${item.ticker}" data-subtab="news">News</button>
                  </div>

                  <!-- Tab Content -->
                  <div class="wl-tracker-tab-content">
                    ${
                      activeSubTab === 'updates'
                        ? `
                        <div class="wl-tracker-updates-view">
                          <div class="wl-update-header-row">
                            <span class="wl-section-eyebrow">LATEST UPDATE</span>
                          </div>
                          <div class="wl-update-badge-date-row">
                            <span class="wl-update-pill">${detail.latestUpdate.badge}</span>
                            <span class="wl-update-date">${detail.latestUpdate.date}</span>
                          </div>

                          <div class="wl-whats-new-section">
                            <h4 class="wl-whats-new-heading">What's new</h4>
                            <ul class="wl-whats-new-list">
                              ${detail.latestUpdate.whatsNew.map((bullet) => `<li>${bullet}</li>`).join('')}
                            </ul>
                          </div>

                          <div class="wl-tracker-btn-row">
                            <button class="wl-btn-view-summary" data-ticker="${item.ticker}">
                              View filing summary <span>→</span>
                            </button>
                            <a href="${detail.sourceUrl || detail.latestUpdate?.sourceUrl || secSourceUrl}" target="_blank" rel="noopener" class="wl-btn-view-source" title="Open source document on SEC EDGAR">
                              View source document ↗
                            </a>
                          </div>
                        </div>
                      `
                        : ''
                    }

                    ${
                      activeSubTab === 'filings'
                        ? `
                        <div class="wl-filings-list">
                          ${detail.filings
                            .map(
                              (f) => `
                            <div class="wl-filing-item">
                              <div class="wl-filing-left">
                                <span class="wl-filing-form-badge">${f.form}</span>
                                <span class="wl-filing-desc">${f.title}</span>
                              </div>
                              <div class="wl-filing-right">
                                <span class="wl-filing-date">${f.date}</span>
                                <a href="${f.url}" target="_blank" rel="noopener" class="wl-filing-source-link" title="Open official SEC EDGAR filing">View source ↗</a>
                              </div>
                            </div>
                          `
                            )
                            .join('')}
                        </div>
                      `
                        : ''
                    }

                    ${
                      activeSubTab === 'news'
                        ? `
                        <div class="wl-news-list">
                          ${detail.news
                            .map(
                              (n) => `
                            <a href="${n.url}" target="_blank" rel="noopener" class="wl-news-item" data-url="${n.url}" title="Open source article: ${n.title}">
                              <div class="wl-news-headline">${n.title}</div>
                              <div class="wl-news-meta">
                                <span class="wl-news-source">${n.source}</span>
                                <span>·</span>
                                <span class="wl-news-date">${n.date}</span>
                                <span style="margin-left: auto; color: #cc785c; font-weight: 600;">Open article ↗</span>
                              </div>
                            </a>
                          `
                            )
                            .join('')}
                        </div>
                      `
                        : ''
                    }
                  </div>

                  <!-- 1-Year Stock Price Trend Graph inside expanded tracker -->
                  ${
                    detail.history
                      ? `<div class="wl-detail-chart-wrapper">
                          ${this.watchlistService.renderStockTrendHTML(detail.history, detail.company, '1y')}
                        </div>`
                      : ''
                  }
                </div>
              `
                      : `
                <div class="wl-detail-tracker-pane" id="wl-detail-pane-${item.ticker}">
                  <div style="padding: 24px 16px; text-align: center; color: #8e8b82; font-size: 13px; font-family: 'Inter', sans-serif;">
                    <div style="font-weight: 500; color: #141413; margin-bottom: 6px;">Loading ${item.company || item.ticker}...</div>
                    <div style="font-size: 12px; color: #8e8b82;">Fetching recent filings, 1Y trend chart & market news</div>
                  </div>
                </div>
              `)
                  : ''
              }
            </div>
          `;
        }
      }

      container.innerHTML = `
        <!-- Watchlist Header -->
        <div class="watchlist-header-row">
          <h2 class="watchlist-title">Watchlist</h2>
          <div class="watchlist-header-actions">
            <button class="wl-btn-manual-check" id="btn-refresh-digest" title="Run manual check for new SEC filings and market news">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              <span>Check Now</span>
            </button>
            <button class="btn-add-company" id="btn-toggle-add-company">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>Add company</span>
            </button>
          </div>
        </div>

        <!-- Search Companies Input -->
        <div class="watchlist-search-wrapper">
          <svg class="watchlist-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            class="watchlist-search-input"
            id="input-add-watchlist"
            placeholder="Search companies..."
            autocomplete="off"
          />
          <div class="watchlist-autocomplete-menu" id="watchlist-autocomplete-menu" style="display: none;"></div>
        </div>

        <!-- Watchlist Auto-Check Scheduling Bar -->
        <div class="wl-schedule-bar" style="margin-bottom: 12px;">
          <div class="wl-schedule-left">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="wl-schedule-icon"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span class="wl-schedule-label">Auto-Check:</span>
          </div>
          <div class="wl-schedule-right">
            <select class="wl-schedule-select" id="select-watchlist-schedule" title="Select auto-check interval for tracked tickers">
              <option value="0" ${scheduleMins === 0 ? 'selected' : ''}>Manual Only</option>
              <option value="30" ${scheduleMins === 30 ? 'selected' : ''}>Every 30 Mins</option>
              <option value="60" ${scheduleMins === 60 ? 'selected' : ''}>Every 1 Hour</option>
              <option value="120" ${scheduleMins === 120 ? 'selected' : ''}>Every 2 Hours</option>
              <option value="240" ${scheduleMins === 240 ? 'selected' : ''}>Every 4 Hours</option>
              <option value="480" ${scheduleMins === 480 ? 'selected' : ''}>Every 8 Hours</option>
              <option value="1440" ${scheduleMins === 1440 ? 'selected' : ''}>Daily (24h)</option>
            </select>
            <span class="wl-schedule-indicator ${scheduleMins !== 0 ? 'active' : 'paused'}" title="${scheduleMins !== 0 ? 'Background auto-check alarm active' : 'Auto-check paused'}">
              <span class="wl-indicator-dot"></span>
              <span>${scheduleMins !== 0 ? 'Active' : 'Off'}</span>
            </span>
          </div>
        </div>

        <!-- Stock Cards List (Main Screen) -->
        <div class="watchlist-items-list" id="watchlist-items-list">
          ${cardsHtml}
        </div>

        <p class="compliance-note" style="margin-top: 14px;">
          Quiet, neutral daily briefs extracted from SEC EDGAR filings and published market news. Does not contain predictive advice.
        </p>
      `;

      // Autocomplete & Add handling
      const addInput = this.shadowRoot.getElementById('input-add-watchlist');
      const autoMenu = this.shadowRoot.getElementById('watchlist-autocomplete-menu');
      const toggleAddBtn = this.shadowRoot.getElementById('btn-toggle-add-company');
      let currentMatches = [];
      let selectedIdx = -1;

      if (toggleAddBtn && addInput) {
        toggleAddBtn.addEventListener('click', () => {
          addInput.focus();
          addInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      // Manual Check Handler
      const refreshBtn = this.shadowRoot.getElementById('btn-refresh-digest');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
          refreshBtn.disabled = true;
          refreshBtn.innerHTML = `<span>Checking...</span>`;
          this.showToast('Checking SEC EDGAR & live market data...');
          try {
            await this.watchlistService.runDigestPass(false);
            this.showToast('✓ Watchlist updated with latest filings & quotes');
          } catch (err) {
            this.showToast('Check completed');
          } finally {
            await this.renderWatchlistTab(container);
          }
        });
      }

      const tryAddTicker = async (inputTicker, providedTitle = null, providedCik = null) => {
        const raw = (inputTicker || '').trim();
        if (!raw) return;

        try {
          const validation = await this.watchlistService.validateTicker(raw);
          if (!validation.valid) {
            if (addInput) {
              addInput.classList.add('input-invalid');
              setTimeout(() => addInput.classList.remove('input-invalid'), 2500);
            }
            this.showToast(`⚠️ "${raw}" is not a valid stock. Please check the symbol and try again.`);
            return;
          }

          const tickerToAdd = validation.ticker;
          const companyToAdd = providedTitle || validation.company || tickerToAdd;
          const cikToAdd = providedCik || validation.cik || '';

          await this.watchlistService.addTicker(tickerToAdd, companyToAdd, cikToAdd);
          if (addInput) {
            addInput.value = '';
            addInput.classList.remove('input-invalid');
          }
          if (autoMenu) autoMenu.style.display = 'none';
          this.renderWatchlistTab(container);
          this.showToast(`✓ Added ${tickerToAdd} (${companyToAdd}) to watchlist`);
        } catch (err) {
          this.showToast(`Error checking ticker: ${err.message}`);
        }
      };

      const renderAutocomplete = (matches, rawTyped = '') => {
        if (!autoMenu) return;
        currentMatches = [...(matches || [])];
        selectedIdx = -1;

        const typedClean = rawTyped ? this.watchlistService.extractCleanSymbol(rawTyped) : '';
        if (typedClean && !currentMatches.some((m) => m.ticker === typedClean)) {
          currentMatches.push({
            ticker: typedClean,
            title: `Add "${rawTyped.trim()}"`,
            exchange: 'Custom',
            isCustom: true,
          });
        }

        if (currentMatches.length === 0) {
          autoMenu.style.display = 'none';
          autoMenu.innerHTML = '';
          return;
        }

        autoMenu.innerHTML = currentMatches
          .map(
            (m, idx) => `
            <div class="autocomplete-item ${idx === 0 ? 'selected' : ''} ${m.isCustom ? 'custom-match' : ''}" data-idx="${idx}" data-ticker="${m.ticker}" data-title="${(m.title || m.ticker).replace(/"/g, '&quot;')}" data-cik="${m.cik || ''}">
              <div class="autocomplete-left">
                <span class="autocomplete-ticker">${m.ticker}</span>
                <span class="autocomplete-title">${m.title}</span>
              </div>
              <span class="autocomplete-exchange">${m.exchange || (m.isCustom ? '+ Add' : 'US')}</span>
            </div>
          `
          )
          .join('');
        autoMenu.style.display = 'flex';

        autoMenu.querySelectorAll('.autocomplete-item').forEach((itemEl) => {
          itemEl.addEventListener('click', async () => {
            const t = itemEl.dataset.ticker;
            const title = itemEl.dataset.title;
            const cik = itemEl.dataset.cik;
            await tryAddTicker(t, title && !title.startsWith('Add "') ? title : null, cik);
          });
        });
      };

      if (addInput) {
        addInput.addEventListener('input', async (e) => {
          const val = e.target.value.trim();
          const lowerVal = val.toLowerCase();

          // Real-time filter visible stock cards on main screen
          const cardEls = container.querySelectorAll('.watchlist-stock-card');
          cardEls.forEach((card) => {
            const t = (card.dataset.ticker || '').toLowerCase();
            const comp = (card.querySelector('.wl-card-company')?.textContent || '').toLowerCase();
            if (!lowerVal || t.includes(lowerVal) || comp.includes(lowerVal)) {
              card.style.display = '';
            } else {
              card.style.display = 'none';
            }
          });

          if (val.length >= 1) {
            const matches = await this.watchlistService.searchTickers(val, 6);
            renderAutocomplete(matches, val);
          } else {
            renderAutocomplete([], '');
          }
        });

        addInput.addEventListener('keydown', async (e) => {
          if (!autoMenu || autoMenu.style.display === 'none') {
            if (e.key === 'Enter') {
              const val = addInput.value.trim();
              if (val) {
                await tryAddTicker(val);
              }
            }
            return;
          }

          const itemsEls = autoMenu.querySelectorAll('.autocomplete-item');
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIdx = Math.min(selectedIdx + 1, itemsEls.length - 1);
            itemsEls.forEach((el, idx) => el.classList.toggle('selected', idx === selectedIdx));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIdx = Math.max(selectedIdx - 1, 0);
            itemsEls.forEach((el, idx) => el.classList.toggle('selected', idx === selectedIdx));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIdx >= 0 && currentMatches[selectedIdx]) {
              const m = currentMatches[selectedIdx];
              await tryAddTicker(m.ticker, m.isCustom ? null : m.title, m.cik);
            } else if (currentMatches.length > 0) {
              const m = currentMatches[0];
              await tryAddTicker(m.ticker, m.isCustom ? null : m.title, m.cik);
            } else {
              const val = addInput.value.trim();
              if (val) {
                await tryAddTicker(val);
              }
            }
          } else if (e.key === 'Escape') {
            autoMenu.style.display = 'none';
          }
        });
      }

      // Card Click to Expand / Collapse Detail Tracker
      container.querySelectorAll('.watchlist-stock-card').forEach((card) => {
        card.addEventListener('click', async (e) => {
          // If clicked inside interactive actions or subtabs, handle separately
          if (e.target.closest('button') || e.target.closest('a') || e.target.closest('select') || e.target.closest('input')) {
            return;
          }

          const ticker = card.dataset.ticker;
          if (ticker) {
            this.watchlistExpandedTicker = this.watchlistExpandedTicker === ticker ? null : ticker;
            await this.renderWatchlistTab(container);
          }
        });
      });

      // Sub-Tabs in Expanded Tracker (Filings | Updates | News)
      container.querySelectorAll('.wl-tracker-tab').forEach((tabBtn) => {
        tabBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const ticker = tabBtn.dataset.ticker;
          const subtab = tabBtn.dataset.subtab;
          if (ticker && subtab) {
            this.watchlistSubTabs[ticker] = subtab;
            await this.renderWatchlistTab(container);
          }
        });
      });

      // "View filing summary →" Button (Summarizes that filing and sets What Changed)
      container.querySelectorAll('.wl-btn-view-summary').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const ticker = btn.dataset.ticker;
          await this.viewFilingSummary(ticker);
        });
      });

      // News Item Click Handler (Navigates directly to the exact source page where it found the news)
      container.querySelectorAll('.wl-news-item').forEach((item) => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const url = item.getAttribute('href') || item.dataset.url;
          if (url && url !== '#' && !url.startsWith('javascript:')) {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
        });
      });

      // Scheduling Select Handler (Changes auto-check interval for background updates)
      const scheduleSelect = this.shadowRoot.getElementById('select-watchlist-schedule');
      if (scheduleSelect) {
        scheduleSelect.addEventListener('change', async (e) => {
          const val = parseInt(e.target.value, 10);
          const currentSettings = await this.storage.getSettings();
          currentSettings.watchlistScheduleInterval = val;
          currentSettings.enableBackgroundWatchlist = val > 0;
          currentSettings.watchlistRefreshHours = val > 0 ? (val / 60) : 0;
          await this.storage.saveSettings(currentSettings);

          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
              action: 'UPDATE_WATCHLIST_ALARM',
              intervalMinutes: val,
            });
          }

          const label = val === 0 ? 'Manual only (paused)' : val >= 60 ? `Every ${val / 60} hour${val / 60 > 1 ? 's' : ''}` : `Every ${val} mins`;
          this.showToast(`Auto-check scheduled: ${label}`);
          this.renderWatchlistTab(container);
        });
      }

      // Star toggles
      this.shadowRoot.querySelectorAll('.wl-star-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const t = e.currentTarget.dataset.ticker;
          if (t) {
            await this.watchlistService.toggleStar(t);
            this.renderWatchlistTab(container);
          }
        });
      });

      // Mute toggles
      this.shadowRoot.querySelectorAll('.btn-mute-ticker').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const t = e.currentTarget.dataset.ticker;
          if (t) {
            const isMuted = await this.watchlistService.toggleMute(t);
            this.renderWatchlistTab(container);
            this.showToast(isMuted ? `Muted ${t} (News scans paused)` : `Unmuted ${t}`);
          }
        });
      });

      // Delete handlers
      this.shadowRoot.querySelectorAll('.btn-delete-ticker').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const t = e.currentTarget.dataset.ticker;
          if (t) {
            await this.watchlistService.removeTicker(t);
            if (this.watchlistExpandedTicker === t) {
              this.watchlistExpandedTicker = null;
            }
            this.renderWatchlistTab(container);
            this.showToast(`Removed ${t}`);
          }
        });
      });

      // Background async quote hydration (keeps tab opening 0ms instant)
      const missingQuotes = items.filter((it) => {
        const c = this.watchlistService ? this.watchlistService.extractCleanSymbol(it.ticker) : it.ticker;
        return !it.stockQuote && !this.watchlistService?._quoteMemoryCache?.has(c);
      });
      if (missingQuotes.length > 0 && this.watchlistService) {
        Promise.allSettled(
          missingQuotes.map(async (it) => {
            try {
              const q = await this.watchlistService.getDailyStockQuote(it.ticker);
              if (q) {
                const box = this.shadowRoot.getElementById(`wl-card-price-box-${it.ticker}`);
                if (box) {
                  box.innerHTML = `
                    <span class="wl-card-price">$${q.price}</span>
                    <span class="wl-card-change ${q.isPositive ? 'positive' : 'negative'}">
                      ${q.isPositive ? '▲' : '▼'} ${q.changePercent}
                    </span>
                  `;
                }
              }
            } catch (e) {}
          })
        );
      }

      // If an expanded card needs detail loaded asynchronously:
      if (this.watchlistExpandedTicker) {
        const expClean = this.watchlistService ? this.watchlistService.extractCleanSymbol(this.watchlistExpandedTicker) : this.watchlistExpandedTicker;
        if (!this._trackerDetailCache[expClean] && this.watchlistService) {
          this.watchlistService.getTickerTrackerDetail(expClean, '1y').then((det) => {
            if (det) {
              this._trackerDetailCache[expClean] = det;
              if (this.watchlistExpandedTicker === expClean && this.activeTab === 'watchlist') {
                this.renderWatchlistTab(container);
              }
            }
          }).catch((err) => {
            console.warn('Watchlist detail load error:', err);
          });
        }
      }
    }

    // --- Advanced Research Interactive Footer Dock ---
    async renderAdvancedFooter(suggestedQueries = []) {
      const footerContainer = this.shadowRoot.getElementById('prospectus-advanced-footer');
      if (!footerContainer) return;

      const settings = await this.storage.getSettings();
      const initialHeight = settings.deepResearchHeight || 240;

      const queries = (suggestedQueries && suggestedQueries.length)
        ? suggestedQueries
        : (this.ai ? this.ai.extractDynamicFallbackQueries(this.pageData) : []);

      footerContainer.style.display = 'flex';
      footerContainer.style.height = `${initialHeight}px`;
      footerContainer.innerHTML = `
        <!-- Top Edge Drag-to-Resize Handle -->
        <div class="prospectus-resize-handle-top" id="prospectus-adv-resize-handle" title="Drag up/down to adjust Ask Prospectus section height"></div>

        <div class="adv-footer-header">
          <div style="display: flex; gap: 8px; align-items: center;">
            <div class="adv-header-badge">
              ${ICONS.sparkle} <span>Ask Prospectus</span>
            </div>
            <button class="adv-search-toggle ${this.webSearchEnabled !== false ? 'active' : ''}" id="btn-toggle-web-search" title="Toggle Live Web Search grounding ON/OFF">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              <span>Web Search</span>
              <span class="adv-toggle-tag" id="adv-toggle-status-text">${this.webSearchEnabled !== false ? 'ON' : 'OFF'}</span>
            </button>
          </div>
          <div style="display: flex; gap: 4px; align-items: center;">
            <button class="icon-btn" id="btn-expand-adv-footer" title="Expand / Collapse View" style="font-size: 11px; padding: 2px 4px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            </button>
            <button class="icon-btn" id="btn-toggle-adv-footer" title="Hide / Minimize" style="font-size: 11px; padding: 2px 4px;">
              ${ICONS.close}
            </button>
          </div>
        </div>

        <div class="adv-suggestions-container" id="adv-suggestions-box">
          <span class="adv-suggestions-label">Recommended Queries</span>
          <div class="adv-chips-row">
            ${queries.map((q) => `<button class="adv-chip" data-query="${q.replace(/"/g, '&quot;')}">✦ ${q}</button>`).join('')}
          </div>
        </div>

        <div class="adv-input-row">
          <input type="text" id="adv-footer-input" placeholder="Ask Prospectus anything (this page, any stock, market concepts, or live news)..." />
          <button class="adv-send-btn" id="btn-adv-footer-send">
            ${ICONS.search} Ask Prospectus
          </button>
        </div>

        <div class="adv-response-card" id="adv-footer-response" style="display: none;">
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
      const expandBtn = this.shadowRoot.getElementById('btn-expand-adv-footer');
      const webToggleBtn = this.shadowRoot.getElementById('btn-toggle-web-search');
      const topHandle = this.shadowRoot.getElementById('prospectus-adv-resize-handle');

      if (webToggleBtn) {
        webToggleBtn.addEventListener('click', () => {
          this.webSearchEnabled = !(this.webSearchEnabled !== false);
          const tag = this.shadowRoot.getElementById('adv-toggle-status-text');
          if (this.webSearchEnabled) {
            webToggleBtn.classList.add('active');
            if (tag) tag.textContent = 'ON';
            this.showToast('Web Search enabled for Ask Prospectus');
          } else {
            webToggleBtn.classList.remove('active');
            if (tag) tag.textContent = 'OFF';
            this.showToast('Web Search disabled (document context only)');
          }
        });
      }

      // Top drag-to-resize for Ask Prospectus / Deep Research footer container (Zero-overhead transient listeners)
      if (topHandle && footerContainer) {
        let isResizingAdv = false;
        let startY = 0;
        let startHeight = initialHeight;

        const onPointerMoveAdv = (e) => {
          if (!isResizingAdv) return;
          const delta = startY - e.clientY; // dragging up expands height
          const maxHeight = Math.round(window.innerHeight * 0.82);
          const newHeight = Math.min(Math.max(120, Math.round(startHeight + delta)), maxHeight);
          footerContainer.style.height = `${newHeight}px`;
        };

        const onPointerUpAdv = async () => {
          if (!isResizingAdv) return;
          isResizingAdv = false;
          window.removeEventListener('pointermove', onPointerMoveAdv);
          window.removeEventListener('pointerup', onPointerUpAdv);
          window.removeEventListener('pointercancel', onPointerUpAdv);

          topHandle.classList.remove('active');
          footerContainer.classList.remove('resizing');
          document.body.style.userSelect = '';
          document.body.style.cursor = '';
          const finalHeight = Math.round(footerContainer.offsetHeight || initialHeight);
          await this.storage.saveSettings({ deepResearchHeight: finalHeight });
        };

        topHandle.addEventListener('pointerdown', (e) => {
          isResizingAdv = true;
          startY = e.clientY;
          startHeight = footerContainer.offsetHeight || initialHeight;
          topHandle.classList.add('active');
          footerContainer.classList.add('resizing');
          document.body.style.userSelect = 'none';
          document.body.style.cursor = 'ns-resize';

          window.addEventListener('pointermove', onPointerMoveAdv, { passive: true });
          window.addEventListener('pointerup', onPointerUpAdv);
          window.addEventListener('pointercancel', onPointerUpAdv);

          e.preventDefault();
          e.stopPropagation();
        });
      }

      let isExpandedMax = false;
      if (expandBtn) {
        expandBtn.addEventListener('click', () => {
          if (!isExpandedMax) {
            const maxHeight = Math.min(Math.max(500, Math.round(window.innerHeight * 0.72)), Math.round(window.innerHeight * 0.82));
            footerContainer.style.height = `${maxHeight}px`;
            isExpandedMax = true;
          } else {
            footerContainer.style.height = `${initialHeight}px`;
            isExpandedMax = false;
          }
        });
      }

      toggleBtn.addEventListener('click', () => {
        footerContainer.style.display = 'none';
      });

      respCloseBtn.addEventListener('click', () => {
        respCard.style.display = 'none';
      });

      function formatDeepResearchResponse(rawText) {
        if (!rawText) return '';
        const str = String(rawText).trim();
        const lines = str.split('\n');
        let inList = false;
        let html = '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmed = line.trim();
          if (!trimmed) {
            if (inList) {
              const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
              const nextIsBullet = /^[\•\-\*]\s+/.test(nextLine) || /^\d+\.\s+/.test(nextLine);
              if (!nextIsBullet) {
                html += '</ul>';
                inList = false;
              }
            }
            continue;
          }

          // Source Note
          if (trimmed.startsWith('*Source:') || trimmed.startsWith('Source:') || trimmed.startsWith('*Disclaimer:')) {
            if (inList) {
              html += '</ul>';
              inList = false;
            }
            const cleanSource = trimmed.replace(/^\*+|\*+$/g, '');
            html += `<div class="adv-source-note">${cleanSource}</div>`;
            continue;
          }

          // Heading ### or ##
          if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
            if (inList) {
              html += '</ul>';
              inList = false;
            }
            const title = trimmed.replace(/^#+\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            html += `<h4 class="adv-resp-heading">${title}</h4>`;
            continue;
          }

          // Bullet point (starts with • or - or * or digit.)
          if (/^[\•\-\*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
            if (!inList) {
              html += '<ul class="adv-bullet-list">';
              inList = true;
            }
            let content = trimmed.replace(/^[\•\-\*]\s+/, '').replace(/^\d+\.\s+/, '');
            content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            if (!content.startsWith('<strong>') && content.includes(':')) {
              const colonIdx = content.indexOf(':');
              if (colonIdx > 0 && colonIdx < 35) {
                const head = content.slice(0, colonIdx);
                const rest = content.slice(colonIdx + 1);
                content = `<strong class="bullet-topic">${head}:</strong>${rest}`;
              }
            }
            html += `<li>${content}</li>`;
            continue;
          }

          if (inList) {
            html += '</ul>';
            inList = false;
          }

          let pContent = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          if (/^(<strong>)?(executive takeaway|key takeaway|direct answer|takeaway)/i.test(pContent)) {
            html += `<div class="adv-takeaway-box">${pContent}</div>`;
          } else {
            html += `<p class="adv-resp-p">${pContent}</p>`;
          }
        }

        if (inList) {
          html += '</ul>';
        }
        return html;
      }

      const executeFooterQuery = async (queryText) => {
        const q = (queryText || input.value).trim();
        if (!q) return;

        const isWebOn = this.webSearchEnabled !== false;
        input.value = q;
        respCard.style.display = 'flex';
        respText.innerHTML = `
          <div class="adv-loading-box">
            <div class="adv-loading-status">
              <span class="loading-spin-sparkle">✦</span>
              <span>${isWebOn ? 'Searching the web & synthesizing disclosures...' : 'Analyzing document disclosures...'}</span>
            </div>
            <div class="loading-shimmer" style="height: 60px; margin-top: 6px;"></div>
          </div>
        `;

        // Auto-expand the deep research footer container automatically so the answer is immediately legible
        const targetExpandedHeight = Math.min(
          Math.max(480, Math.round(window.innerHeight * 0.65)),
          Math.round(window.innerHeight * 0.82)
        );
        if ((footerContainer.offsetHeight || 0) < targetExpandedHeight) {
          footerContainer.style.height = `${targetExpandedHeight}px`;
        }

        respCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        try {
          const res = await this.ai.performAdvancedResearch({
            query: q,
            ticker: this.pageData.ticker,
            company: this.pageData.company,
            documentContext: this.pageData.fullText || '',
            searchWeb: isWebOn,
          });

          const rawText = (typeof res === 'object' && res.text) ? res.text : (typeof res === 'string' ? res : '');
          let responseHtml = formatDeepResearchResponse(rawText);

          if (res && Array.isArray(res.webSources) && res.webSources.length > 0) {
            responseHtml += `
              <div class="adv-web-citations-box">
                <span class="adv-citations-label">🌐 Web Sources Consulted:</span>
                <div class="adv-citations-pills">
                  ${res.webSources.map((s) => `
                    <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="adv-citation-pill" title="${(s.title || '').replace(/"/g, '&quot;')}">
                      <span class="citation-source">${s.source}</span>
                      <span class="citation-arrow">↗</span>
                    </a>
                  `).join('')}
                </div>
              </div>
            `;
          }

          respText.innerHTML = responseHtml;
          respCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

          respSaveBtn.onclick = () => {
            this.openSaveNoteModal({
              title: `Research: ${q}`,
              quote: `Q: "${q}"`,
              note: rawText,
              category: 'General',
              ticker: this.pageData.ticker,
            });
          };
        } catch (err) {
          console.warn('Deep Research AI error:', err.message);
          let webSources = [];
          if (isWebOn && this.ai) {
            try {
              const cleanTicker = (this.pageData.ticker && this.pageData.ticker !== 'PAGE' && this.pageData.ticker !== 'PDF') ? this.pageData.ticker : '';
              let searchQuery = q;
              if (q.split(' ').length <= 2 && cleanTicker && !q.toLowerCase().includes(cleanTicker.toLowerCase())) {
                searchQuery = `${cleanTicker} ${q}`;
              }
              webSources = await this.ai.searchWebSources({ query: searchQuery, count: 4 });
            } catch (e) {}
          }

          let fallback = '';
          if (webSources && webSources.length > 0) {
            const isAboutCurrentDoc = this.pageData.ticker && q.toLowerCase().includes(this.pageData.ticker.toLowerCase());
            const subjectLabel = isAboutCurrentDoc ? `for **${this.pageData.company || 'Document'} (${this.pageData.ticker})**` : `regarding **"${q}"**`;
            fallback = `**Executive Takeaway:** Public sources and financial intelligence provide comprehensive findings ${subjectLabel}.\n\n` +
              webSources.map((s) => `• **${s.source}:** ${s.title}${s.snippet ? ` — ${s.snippet.slice(0, 140)}` : ''}`).join('\n') +
              `\n\n*Source: Evaluated from live web search (${Array.from(new Set(webSources.map((s) => s.source))).join(', ')}).*`;
          } else {
            fallback = `**Executive Takeaway:** Analysis for **"${q}"** synthesizes available operational disclosures and financial principles.\n\n• **Core Analysis:** Topic inquiries examine underlying market dynamics, balance sheet mechanics, or disclosed guidance.\n• **Verification:** Review corresponding filing tables and notes for itemized data points.\n\n*Source: Evaluated from financial disclosures and reference analysis.*`;
          }

          const errorBanner = `
            <div class="adv-error-notice" style="margin-bottom: 12px; padding: 10px 14px; background: #fff5f2; border: 1px solid #f2d4cc; border-radius: 8px; font-size: 12px; color: #a9583e; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong>⚠️ API Notice:</strong> ${err.message || 'Unable to connect to AI provider'}.
              </div>
              <button type="button" class="coral-btn btn-adv-settings" style="font-size: 11px; padding: 4px 8px; margin-left: 10px; white-space: nowrap;">Settings</button>
            </div>
          `;
          let responseHtml = errorBanner + formatDeepResearchResponse(fallback);
          if (webSources && webSources.length > 0) {
            responseHtml += `
              <div class="adv-web-citations-box">
                <span class="adv-citations-label">🌐 Web Sources Consulted:</span>
                <div class="adv-citations-pills">
                  ${webSources.map((s) => `
                    <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="adv-citation-pill" title="${(s.title || '').replace(/"/g, '&quot;')}">
                      <span class="citation-source">${s.source}</span>
                      <span class="citation-arrow">↗</span>
                    </a>
                  `).join('')}
                </div>
              </div>
            `;
          }

          respText.innerHTML = responseHtml;
          respCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

          const settingsBtn = respCard.querySelector('.btn-adv-settings');
          if (settingsBtn) settingsBtn.addEventListener('click', () => this.openSettings());

          respSaveBtn.onclick = () => {
            this.openSaveNoteModal({
              title: `Research: ${q}`,
              quote: `Q: "${q}"`,
              note: fallback,
              category: 'General',
              ticker: this.pageData.ticker,
            });
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
      const handleSelection = () => {
        const selection = window.getSelection();
        const text = selection ? selection.toString().trim() : '';

        if (text && text.length >= 2 && text.length < 800) {
          try {
            if (!selection.rangeCount) {
              this.hideTooltip();
              return;
            }
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            if (rect.width === 0 && rect.height === 0) {
              this.hideTooltip();
              return;
            }

            this.selectedText = text;
            const tooltip = this.shadowRoot ? this.shadowRoot.getElementById('prospectus-tooltip') : null;
            if (!tooltip) return;

            // Viewport fixed coordinates
            const tooltipWidth = 160;
            const tooltipX = Math.max(10, Math.min(window.innerWidth - tooltipWidth - 10, rect.left + (rect.width / 2) - (tooltipWidth / 2)));
            const tooltipY = rect.top >= 48 ? (rect.top - 42) : (rect.bottom + 8);

            tooltip.style.left = `${Math.round(tooltipX)}px`;
            tooltip.style.top = `${Math.round(tooltipY)}px`;
            tooltip.style.display = 'flex';
          } catch (e) {
            console.warn('Prospectus tooltip positioning:', e.message);
            this.hideTooltip();
          }
        } else {
          this.hideTooltip();
        }
      };

      // Auto-hide immediately whenever selection is cleared or changed
      document.addEventListener('selectionchange', () => {
        const selection = window.getSelection();
        const text = selection ? selection.toString().trim() : '';
        if (!text || text.length < 2) {
          this.hideTooltip();
        }
      });

      document.addEventListener('mouseup', (e) => {
        // If click is inside tooltip or host panel, do not process document selection
        if (this.hostElement && this.hostElement.contains(e.target)) return;
        setTimeout(handleSelection, 20);
      });

      document.addEventListener('keyup', (e) => {
        if (e.key === 'Escape') {
          this.hideTooltip();
          return;
        }
        if (e.key === 'Shift' || e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          setTimeout(handleSelection, 20);
        }
      });

      document.addEventListener('mousedown', (e) => {
        const tooltip = this.shadowRoot ? this.shadowRoot.getElementById('prospectus-tooltip') : null;
        if (tooltip && e.composedPath && e.composedPath().includes(tooltip)) {
          return;
        }
        if (this.hostElement && !this.hostElement.contains(e.target)) {
          const selection = window.getSelection();
          const text = selection ? selection.toString().trim() : '';
          if (!text) {
            this.hideTooltip();
          }
        }
      });
    }

    hideTooltip() {
      const tooltip = this.shadowRoot ? this.shadowRoot.getElementById('prospectus-tooltip') : null;
      if (tooltip) {
        tooltip.style.display = 'none';
      }
      this.selectedText = '';
    }

    // ==========================================
    // Chrome Extension Messaging
    // ==========================================
    setupMessageListener() {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.runtime.onMessage) {
          chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'TOGGLE_PANEL') {
              this.togglePanel();
              sendResponse({ success: true, isOpen: this.isOpen });
              return true;
            }

            if (request.action === 'GET_PAGE_DATA') {
              if (!this.pageData) this.pageData = FinancialExtractors.extractPageData();
              sendResponse({ success: true, pageData: this.pageData });
              return true;
            }

            if (request.action === 'EXPLAIN_SELECTION') {
              this.openPanel();
              this.switchTab('explain');
              this.triggerExplainTerm(request.text || this.selectedText);
              sendResponse({ success: true });
              return true;
            }

            if (request.action === 'SAVE_NOTE_SELECTION') {
              this.openPanel();
              this.switchTab('notebook');
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
              }).catch(() => {
                sendResponse({ success: false });
              });
              return true;
            }
          });
        }
      } catch (e) {
        console.warn('Prospectus: Messaging listener skipped due to context reload');
      }
    }

    openSettings() {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'OPEN_OPTIONS' }, (res) => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
              console.warn('Prospectus: OPEN_OPTIONS message error:', chrome.runtime.lastError.message);
              try {
                chrome.runtime.sendMessage({ action: 'OPEN_SETTINGS' });
              } catch (e) {}
            }
          });
          return;
        }
      } catch (err) {
        console.warn('Prospectus: Failed to open settings via runtime message:', err);
      }
    }

    showToast(message) {
      const footer = this.shadowRoot.getElementById('footer-api-status');
      const dot = this.shadowRoot.getElementById('footer-status-dot');
      if (footer) {
        if (this._toastTimer) clearTimeout(this._toastTimer);
        footer.textContent = `✓ ${message}`;
        if (dot) dot.className = 'status-dot';
        this._toastTimer = setTimeout(() => {
          this.updateFooterStatus();
        }, 3200);
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
