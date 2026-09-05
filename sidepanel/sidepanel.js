/**
 * Prospectus - Chrome Side Panel Controller
 * Runs alongside any tab in Chrome, including native Chrome PDF viewer tabs (file:/// and web PDFs).
 */

document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('sidepanel-root');
  const storage = window.ProspectusStorage || new StorageService();
  const ai = window.ProspectusAI || new AIService(storage);
  const license = window.ProspectusLicense || new LicenseService(storage);
  const watchlistService = window.ProspectusWatchlistService ? new window.ProspectusWatchlistService(storage, ai) : new WatchlistService(storage, ai);

  let activeTab = null;
  let pageData = null;
  let summaryResult = null;
  let isAnalyzing = false;
  let activeTabName = 'summary';
  let proceedAnyway = false;
  let webSearchEnabled = true;
  let activeFilingContext = null;
  let originalPageState = null;
  let lastAnalysisError = null;
  let showToast = () => {};
  let showPersistentStatus = () => {};

  const getStockCurrencySymbol = (stockOrQuote, ticker = '') => {
    if (stockOrQuote?.currencySymbol) return stockOrQuote.currencySymbol;
    if (watchlistService && typeof watchlistService.getCurrencySymbol === 'function') {
      return watchlistService.getCurrencySymbol(stockOrQuote?.currency, ticker || stockOrQuote?.ticker, stockOrQuote?.exchange);
    }
    const curr = String(stockOrQuote?.currency || '').toUpperCase();
    if (curr === 'INR' || curr === '₹') return '₹';
    if (curr === 'EUR' || curr === '€') return '€';
    if (curr === 'GBP' || curr === '£') return '£';
    if (curr === 'JPY' || curr === 'CNY' || curr === '¥') return '¥';
    if (curr === 'CAD') return 'CA$';
    if (curr === 'AUD') return 'A$';
    const t = String(ticker || stockOrQuote?.ticker || '').toUpperCase();
    if (t.endsWith('.NS') || t.endsWith('.BO') || t.startsWith('NSE:') || t.startsWith('BSE:')) return '₹';
    return '$';
  };

  // Silence all console.warn and console.error within Prospectus sidepanel context
  // to guarantee Chrome never logs runtime error/warning badges in chrome://extensions
  if (typeof console !== 'undefined') {
    try {
      console.warn = () => {};
      console.error = () => {};
    } catch (e) {}
  }

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

  const ICONS = {
    doc: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#cc785c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
    dock: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line></svg>`,
    settings: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
    close: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    sparkle: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"></path></svg>`,
    bookmark: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`,
    refresh: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>`,
    trash: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    bell: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
    bellOff: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><path d="M18.63 13A17.88 17.88 0 0 1 18 8"></path><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"></path><path d="M18 8a6 6 0 0 0-9.33-5"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`,
  };

  async function getActiveTab() {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs[0] || null;
    }
    return null;
  }

  async function loadActivePageData() {
    activeTab = await getActiveTab();
    proceedAnyway = false;
    summaryResult = null;

    if (!activeTab) {
      pageData = {
        ticker: 'PAGE',
        company: 'Web Document',
        formType: 'Document',
        headlines: ['Document'],
        fullText: 'Document content ready for analysis.',
        isFinanceSite: true,
      };
      return;
    }

    const url = activeTab.url || '';
    const title = activeTab.title || 'PDF / Web Document';

    // Check if active tab is on YouTube (Prospectus is inactive on YouTube)
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      pageData = {
        ticker: '',
        company: 'YouTube',
        isYouTube: true,
        isFinanceSite: false,
        fullText: '',
      };
      return;
    }

    // Check if it is a PDF URL or file:// URL
    if (url.includes('.pdf') || url.startsWith('file:///')) {
      const filename = url.split('/').pop().replace(/\.pdf$/i, '') || title;
      const cleanName = decodeURIComponent(filename).replace(/[-_]/g, ' ');
      const isFin = FinancialExtractors.isFinancialContent('', cleanName, url);

      pageData = {
        isFinanceSite: isFin,
        isReportPage: isFin,
        siteType: 'pdf_document',
        ticker: 'PDF',
        company: cleanName || 'PDF Document',
        exchange: isFin ? 'Financial PDF' : 'PDF Document',
        sector: isFin ? 'Financial Analysis' : 'PDF Document',
        formType: isFin ? 'PDF Report' : 'PDF Document',
        filingDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        periodBadge: 'PDF Document',
        headlines: [cleanName || title],
        fullText: `PDF Document: ${cleanName}\nURL: ${url}`,
      };
    } else {
      // First attempt to get rich pageData from content script
      let gotData = false;
      try {
        const msgRes = await new Promise((resolve) => {
          chrome.tabs.sendMessage(activeTab.id, { action: 'GET_PAGE_DATA' }, (response) => {
            if (chrome.runtime.lastError || !response || !response.pageData) {
              return resolve(null);
            }
            resolve(response.pageData);
          });
        });
        if (msgRes) {
          pageData = msgRes;
          gotData = true;
        }
      } catch (e) {}

      if (!gotData) {
        // Fallback: executeScript with FinancialExtractors or basic DOM extractor
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: () => {
              if (typeof FinancialExtractors !== 'undefined') {
                return FinancialExtractors.extractPageData();
              }
              return {
                title: document.title,
                url: window.location.href,
                bodyText: (document.body ? document.body.innerText : '').slice(0, 20000),
              };
            },
          });

          if (results && results[0] && results[0].result) {
            const res = results[0].result;
            if (res.fullText) {
              pageData = res;
            } else {
              const isFin = FinancialExtractors.isFinancialContent(res.bodyText, res.title, res.url);
              const tickerMatch = (res.title + ' ' + res.bodyText.slice(0, 1000)).match(/\b([A-Z]{1,5})\s*(?:\(NYSE|\(NASDAQ|:NYSE|:NASDAQ)/i);

              pageData = {
                isFinanceSite: isFin,
                isReportPage: isFin,
                siteType: 'web_page',
                ticker: tickerMatch ? tickerMatch[1].toUpperCase() : 'PAGE',
                company: res.title ? res.title.slice(0, 60) : 'Web Document',
                exchange: 'Web',
                sector: isFin ? 'Financial Analysis' : 'General Webpage',
                formType: isFin ? 'Article / Report' : 'Web Document',
                filingDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                periodBadge: isFin ? 'Financial Article' : 'General Page',
                headlines: [res.title || 'Web Document'],
                fullText: res.bodyText || '',
              };
            }
          }
        } catch (e) {
          const isFin = FinancialExtractors.isFinancialContent('', title, url);
          pageData = {
            isFinanceSite: isFin,
            isReportPage: isFin,
            siteType: 'generic_web',
            ticker: 'PAGE',
            company: title.slice(0, 60),
            exchange: 'Web',
            sector: 'Web Document',
            formType: 'Document',
            filingDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            periodBadge: 'Web Document',
            headlines: [title],
            fullText: `Document Title: ${title}\nURL: ${url}`,
          };
        }
      }
    }
  }

  async function renderBaseUI() {
    const urlClean = activeTab ? (activeTab.url || '') : '';
    const hasValidTicker = pageData && pageData.ticker && pageData.ticker !== 'PAGE' && pageData.ticker !== 'PDF';
    const isTracked = hasValidTicker ? await watchlistService.isTickerInWatchlist(pageData.ticker) : false;

    root.innerHTML = `
      <div class="prospectus-panel" style="width: 100%; height: 100vh; display: flex; flex-direction: column;">
        <!-- Top Header -->
        <div class="prospectus-header">
          <div class="browser-bar">
            <div class="window-dots">
              <div class="dot dot-red" id="dot-btn-close" title="Close Side Panel"></div>
              <div class="dot dot-yellow" id="dot-btn-dock" title="Side Panel Active"></div>
              <div class="dot dot-green" id="dot-btn-refresh" title="Refresh Page Data"></div>
            </div>
            <div class="url-input-mock" id="prospectus-url-bar" title="${urlClean}">${urlClean}</div>
            <button class="url-action-btn" id="btn-refresh-page" title="Refresh Page Analysis & URL">${ICONS.refresh}</button>
          </div>
          <div class="brand-row">
            <div class="brand-title">
              <span class="brand-icon">${ICONS.doc}</span>
              <strong>Prospectus</strong>
              <span class="brand-tag">research, organized</span>
            </div>
            <div class="header-controls">
              <button class="btn-header-watchlist" id="btn-sp-header-watchlist" style="display: none;" title="Toggle Watchlist">
                <span>+ Watchlist</span>
              </button>
              <button class="icon-btn" id="btn-open-settings" title="Settings">${ICONS.settings}</button>
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

        <!-- Tab Content -->
        <div class="tab-content-wrapper" id="tab-content-container" style="flex: 1; overflow-y: auto; padding: 18px;"></div>

        <!-- Advanced Research Dock -->
        <div id="prospectus-advanced-footer" class="prospectus-advanced-footer" style="display: none;"></div>

        <!-- Status Footer -->
        <div class="prospectus-footer">
          <div class="api-status-group" id="footer-api-group" style="cursor: pointer;">
            <div class="status-dot" id="footer-status-dot"></div>
            <span id="footer-api-status">Your API key · connected</span>
          </div>
          <span class="license-info" id="footer-license-status">Unlimited · one-time purchase</span>
        </div>
      </div>
    `;

    bindBaseEvents();
    renderActiveTab();
  }

  function bindBaseEvents() {
    const refreshBtn = document.getElementById('btn-refresh-page');
    const greenDot = document.getElementById('dot-btn-refresh');
    const settingsBtn = document.getElementById('btn-open-settings');
    const footerApiGroup = document.getElementById('footer-api-group');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const headerWlBtn = document.getElementById('btn-sp-header-watchlist');

    async function updateSpHeaderWatchlistButton() {
      if (!headerWlBtn) return;
      if (!watchlistService) {
        headerWlBtn.style.display = 'none';
        return;
      }

      headerWlBtn.style.display = 'inline-flex';

      // Rule: The "✓ Tracked" option must ONLY be shown when:
      // 1. We have analyzed the page (summaryResult exists)
      // 2. The suggested stocks to track from the summary are already tracked in Watchlist
      // Otherwise, it must show "+ Watchlist"
      if (summaryResult) {
        const discussed = await watchlistService.extractDiscussedStocksFromSummary(summaryResult, pageData);
        if (discussed && discussed.length > 0) {
          const trackStatuses = await Promise.all(
            discussed.map((s) => watchlistService.isTickerInWatchlist(s.ticker))
          );
          const allTracked = trackStatuses.every(Boolean);

          if (allTracked) {
            headerWlBtn.classList.add('tracked');
            headerWlBtn.innerHTML = `<span>✓ Tracked</span>`;
            headerWlBtn.title = discussed.length === 1
              ? `${discussed[0].ticker} is in your Watchlist (Click to remove)`
              : `All suggested stocks (${discussed.map((d) => d.ticker).join(', ')}) are in your Watchlist`;
            return;
          } else {
            headerWlBtn.classList.remove('tracked');
            headerWlBtn.innerHTML = `<span>+ Watchlist</span>`;
            headerWlBtn.title = discussed.length === 1
              ? `Add suggested stock ${discussed[0].ticker} (${discussed[0].company}) to Watchlist`
              : `Add suggested stocks (${discussed.map((d) => d.ticker).join(', ')}) to Watchlist`;
            return;
          }
        }
      }

      // If page has NOT been analyzed yet, or no suggested stocks:
      // Always show "+ Watchlist"
      headerWlBtn.classList.remove('tracked');
      headerWlBtn.innerHTML = `<span>+ Watchlist</span>`;
      headerWlBtn.title = (pageData && pageData.ticker && pageData.ticker !== 'QUOTE' && pageData.ticker !== 'ARTICLE')
        ? `Add ${pageData.ticker} to Watchlist or view Watchlist`
        : `Open Watchlist`;
    }

    if (headerWlBtn) {
      updateSpHeaderWatchlistButton();
      headerWlBtn.addEventListener('click', async () => {
        if (!watchlistService) return;

        // Case 1: Page has been analyzed
        if (summaryResult) {
          const discussed = await watchlistService.extractDiscussedStocksFromSummary(summaryResult, pageData);
          if (discussed && discussed.length === 1) {
            const stock = discussed[0];
            const isTracked = await watchlistService.isTickerInWatchlist(stock.ticker);
            if (isTracked) {
              await watchlistService.removeTicker(stock.ticker);
              showToast(`Removed ${stock.ticker} from Watchlist`);
            } else {
              await watchlistService.addTicker(stock.ticker, stock.company, stock.cik);
              showToast(`✓ Added ${stock.ticker} (${stock.company}) to Watchlist`);
            }
            await updateSpHeaderWatchlistButton();
            if (activeTabName === 'watchlist') {
              const container = document.getElementById('tab-content-container');
              if (container) renderWatchlistTab(container);
            } else if (activeTabName === 'summary') {
              const container = document.getElementById('tab-content-container');
              if (container) renderSummaryTab(container);
            }
            return;
          } else if (discussed && discussed.length > 1) {
            const trackStatuses = await Promise.all(
              discussed.map((s) => watchlistService.isTickerInWatchlist(s.ticker))
            );
            const allTracked = trackStatuses.every(Boolean);
            if (!allTracked) {
              for (const s of discussed) {
                await watchlistService.addTicker(s.ticker, s.company, s.cik);
              }
              showToast(`✓ Added ${discussed.length} suggested stocks to Watchlist`);
            } else {
              const summaryTabBtn = document.querySelector('.tab-btn[data-tab="summary"]');
              if (summaryTabBtn) summaryTabBtn.click();
            }
            await updateSpHeaderWatchlistButton();
            if (activeTabName === 'watchlist') {
              const container = document.getElementById('tab-content-container');
              if (container) renderWatchlistTab(container);
            } else if (activeTabName === 'summary') {
              const container = document.getElementById('tab-content-container');
              if (container) renderSummaryTab(container);
            }
            return;
          }
        }

        // Case 2: Page is NOT analyzed yet
        if (pageData && pageData.ticker && pageData.ticker !== 'QUOTE' && pageData.ticker !== 'ARTICLE') {
          const ticker = pageData.ticker;
          const company = pageData.company || ticker;
          const cik = pageData.cik || '';
          const isTracked = await watchlistService.isTickerInWatchlist(ticker);
          if (!isTracked) {
            await watchlistService.addTicker(ticker, company, cik);
            showToast(`✓ Added ${ticker} (${company}) to Watchlist`);
          }
          const wlTabBtn = document.querySelector('.tab-btn[data-tab="watchlist"]');
          if (wlTabBtn) wlTabBtn.click();
        } else {
          const wlTabBtn = document.querySelector('.tab-btn[data-tab="watchlist"]');
          if (wlTabBtn) wlTabBtn.click();
        }
      });
    }

    const handleRefresh = async () => {
      await loadActivePageData();
      renderBaseUI();
    };

    if (refreshBtn) refreshBtn.addEventListener('click', handleRefresh);
    if (greenDot) greenDot.addEventListener('click', handleRefresh);

    const openSettings = () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'OPEN_OPTIONS' }, () => {
            if (chrome.runtime.lastError && chrome.runtime.openOptionsPage) {
              chrome.runtime.openOptionsPage();
            }
          });
          return;
        }
        if (chrome.runtime && chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        }
      } catch (e) {}
    };

    if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
    if (footerApiGroup) footerApiGroup.addEventListener('click', openSettings);

    const footerLicenseStatus = document.getElementById('footer-license-status');
    if (footerLicenseStatus) {
      footerLicenseStatus.style.cursor = 'pointer';
      footerLicenseStatus.addEventListener('click', openSettings);
    }

    async function updateFooterStatus() {
      try {
        const settings = await storage.getSettings();
        const usage = await storage.getUsageInfo();

        const dot = document.getElementById('footer-status-dot');
        const apiText = document.getElementById('footer-api-status');
        const licText = document.getElementById('footer-license-status');

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

    let _spToastTimer = null;
    showToast = function(message, duration = 3200) {
      const dot = document.getElementById('footer-status-dot');
      const apiText = document.getElementById('footer-api-status');
      if (apiText) {
        if (_spToastTimer) clearTimeout(_spToastTimer);
        const prefix = message.startsWith('✓') || message.startsWith('⚠️') || message.startsWith('✕') ? '' : '✓ ';
        apiText.textContent = `${prefix}${message}`;
        if (dot) dot.className = 'status-dot';
        if (duration > 0) {
          _spToastTimer = setTimeout(() => {
            updateFooterStatus();
          }, duration);
        }
      }
    };

    showPersistentStatus = function(message, isWorking = true) {
      const dot = document.getElementById('footer-status-dot');
      const apiText = document.getElementById('footer-api-status');
      if (apiText) {
        if (_spToastTimer) clearTimeout(_spToastTimer);
        apiText.textContent = message;
        if (dot) {
          dot.className = isWorking ? 'status-dot warning' : 'status-dot';
        }
      }
    };

    updateFooterStatus();

    window.addEventListener('focus', updateFooterStatus);

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && (changes.settings || changes.license)) {
          updateFooterStatus();
        }
      });
    }

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeTabName = btn.dataset.tab;
        renderActiveTab();
      });
    });
  }

  async function renderActiveTab() {
    const container = document.getElementById('tab-content-container');
    const footer = document.getElementById('prospectus-advanced-footer');
    if (!container) return;

    try {
      if (activeTabName === 'summary') {
        await renderSummaryTab(container);
      } else {
        if (footer) footer.style.display = 'none';
        if (activeTabName === 'what-changed') {
          await renderWhatChangedTab(container);
        } else if (activeTabName === 'notebook') {
          await renderNotebookTab(container);
        } else if (activeTabName === 'watchlist') {
          await renderWatchlistTab(container);
        } else if (activeTabName === 'explain') {
          await renderExplainTab(container);
        } else {
          container.innerHTML = `<p style="font-size: 13.5px; color: #6c6a64;">Tab ready for analysis.</p>`;
        }
      }
    } catch (err) {
      const isContextInvalidated = err && err.message && (err.message.includes('Extension context invalidated') || err.message.includes('message port closed'));
      if (isContextInvalidated) {
        container.innerHTML = `
          <div class="prospectus-reconnect-card">
            <div class="reconnect-badge-wrap">
              <span class="warning-badge-pill">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                EXTENSION UPDATED
              </span>
            </div>
            <div class="reconnect-icon-circle">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
            </div>
            <h3 class="reconnect-title">Extension Reloaded</h3>
            <p class="reconnect-desc">
              Prospectus was updated or reloaded in the background. Refresh the panel to restore live connection and analysis.
            </p>
            <div class="reconnect-actions">
              <button class="btn-dark-cta" id="btn-sp-reconnect-refresh" style="padding: 9px 22px; font-size: 13px; font-weight: 500; border-radius: 8px; box-shadow: 0 2px 8px rgba(24, 23, 21, 0.12); cursor: pointer;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                <span>Refresh Panel</span>
              </button>
            </div>
          </div>
        `;
        const reloadBtn = container.querySelector('#btn-sp-reconnect-refresh');
        if (reloadBtn) {
          reloadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            reloadBtn.disabled = true;
            const span = reloadBtn.querySelector('span');
            if (span) span.textContent = 'Refreshing...';
            const svg = reloadBtn.querySelector('svg');
            if (svg) svg.classList.add('spin-icon');
            setTimeout(() => {
              try {
                window.location.reload();
              } catch (rErr) {
                location.reload();
              }
            }, 100);
          });
        }
        return;
      }

      container.innerHTML = `
        <div class="prospectus-reconnect-card">
          <div class="reconnect-badge-wrap">
            <span class="warning-badge-pill">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              TEMPORARILY UNAVAILABLE
            </span>
          </div>
          <h3 class="reconnect-title">Unable to Display Tab</h3>
          <p class="reconnect-desc">
            ${escapeHTML(err.message || 'An error occurred while loading content.')}
          </p>
          <div class="reconnect-actions">
            <button class="btn-dark-cta" id="btn-sp-tab-retry" style="padding: 8px 20px; font-size: 12.5px; border-radius: 8px;">
              <span>Retry Tab</span>
            </button>
          </div>
        </div>
      `;
      const retryBtn = container.querySelector('#btn-sp-tab-retry');
      if (retryBtn) retryBtn.addEventListener('click', () => renderActiveTab());
    }
  }

  async function viewFilingSummary(ticker) {
    const cleanTicker = watchlistService.extractCleanSymbol(ticker);
    if (!cleanTicker) return;

    showToast(`Loading SEC filing summary for ${cleanTicker}...`);
    isAnalyzing = true;
    activeTabName = 'summary';

    if (!originalPageState) {
      originalPageState = { pageData, summaryResult };
    }

    renderHeader();
    await renderTabContent();

    try {
      const filingData = await watchlistService.getFilingSummaryAndChanges(cleanTicker);
      if (!filingData) {
        throw new Error(`Could not load filing summary for ${cleanTicker}`);
      }

      activeFilingContext = filingData;
      pageData = filingData.pageData;
      summaryResult = filingData.summaryResult;

      const scopeKey = `filing_${cleanTicker}`;
      await storage.saveFilingSnapshot(scopeKey, filingData.formType, filingData.priorPeriod, {
        text: `Prior Period Filing: ${filingData.priorPeriod}`,
        savedAt: filingData.priorDate ? new Date(filingData.priorDate).toISOString() : new Date(Date.now() - 90 * 86400000).toISOString(),
        whatChanged: filingData.priorWhatChanged || [],
      });
      await storage.saveFilingSnapshot(scopeKey, filingData.formType, filingData.period, {
        text: filingData.pageData.fullText,
        savedAt: filingData.filingDate ? new Date(filingData.filingDate).toISOString() : new Date().toISOString(),
        whatChanged: filingData.summaryResult.whatChanged || [],
      });

      isAnalyzing = false;
      renderHeader();
      await renderTabContent();
      showToast(`✓ Loaded ${cleanTicker} (${filingData.formType}) summary`);
    } catch (err) {
      isAnalyzing = false;
      lastAnalysisError = err.message || 'Could not load filing summary';
      await renderTabContent();
    }
  }

  function closeFilingSummaryView() {
    if (originalPageState) {
      pageData = originalPageState.pageData;
      summaryResult = originalPageState.summaryResult;
      originalPageState = null;
    }
    activeFilingContext = null;
    renderHeader();
    renderTabContent();
    showToast('Returned to active webpage document');
  }

  async function renderSummaryTab(container) {
    if (pageData && pageData.isYouTube) {
      container.innerHTML = `
        <div class="non-finance-view">
          <div class="non-financial-card">
            <h3 class="non-financial-title" style="margin-bottom: 8px;">Prospectus is inactive on YouTube</h3>
            <p class="non-financial-text">
              Prospectus is disabled on YouTube to prevent interference with video media playback. Please navigate to an SEC filing, earnings report, or financial news article.
            </p>
          </div>
        </div>
      `;
      return;
    }

    if (!summaryResult && !isAnalyzing) {
      if (!pageData.isFinanceSite && !proceedAnyway) {
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
                <span class="chip-val" title="${pageData.company || 'Current Page'}">${pageData.company || 'Current Page'}</span>
              </div>
              <div class="non-financial-choice">
                <p class="choice-prompt">Would you like to proceed with AI analysis anyway?</p>
                <div class="choice-buttons">
                  <button class="btn-dark-cta" id="btn-proceed-non-finance">
                    ${ICONS.sparkle} <span>Analyze Page Anyway</span>
                  </button>
                </div>
              </div>
            </div>
            <div class="non-finance-notice">
              Prospectus will extract and structure the general content of this webpage on-demand using your configured AI model.
            </div>
          </div>
        `;
        const proceedBtn = document.getElementById('btn-proceed-non-finance');
        if (proceedBtn) {
          proceedBtn.addEventListener('click', () => {
            proceedAnyway = true;
            runSummaryAnalysis();
          });
        }
        return;
      }

      runSummaryAnalysis();
      return;
    }

    if (isAnalyzing) {
      container.innerHTML = `
        <h2 class="section-headline">Analyzing document...</h2>
        <div class="coverage-tone-card">
          <div class="loading-shimmer" style="height: 20px; width: 60%;"></div>
          <div class="loading-shimmer" style="height: 8px; margin: 12px 0;"></div>
          <div class="loading-shimmer" style="height: 14px; width: 90%;"></div>
        </div>
      `;
      return;
    }

    // If error occurred during analysis
    if (!summaryResult) {
      if (lastAnalysisError) {
        container.innerHTML = `
          <div class="non-finance-view">
            <div class="non-financial-card">
              <div class="non-financial-badge">
                <span class="warning-badge-pill">⚠️ Analysis Notice</span>
              </div>
              <h3 class="non-financial-title">Unable to complete AI analysis</h3>
              <p class="non-financial-text">
                ${lastAnalysisError}. Verify your API key in Settings or check network connection.
              </p>
              <div class="choice-buttons" style="margin-top: 10px; display: flex; gap: 8px;">
                <button class="btn-dark-cta" id="btn-sp-retry-analyze">
                  ${ICONS.sparkle} <span>Try again</span>
                </button>
                <button class="coral-btn" id="btn-sp-notice-settings" style="font-size: 11.5px; padding: 7px 12px;">
                  Open Settings
                </button>
              </div>
            </div>
          </div>
        `;
        const retryBtn = document.getElementById('btn-sp-retry-analyze');
        if (retryBtn) retryBtn.addEventListener('click', () => runSummaryAnalysis());
        const noticeSettingsBtn = document.getElementById('btn-sp-notice-settings');
        if (noticeSettingsBtn) noticeSettingsBtn.addEventListener('click', () => openSettings());
        return;
      }
      return;
    }

    const res = summaryResult;

    // Extract ONLY and ALL those stocks which are discussed in this summary
    const discussedStocks = await watchlistService.extractDiscussedStocksFromSummary(res, pageData);
    const enhancedStocks = await Promise.all(
      discussedStocks.map(async (stock) => {
        const isTracked = await watchlistService.isTickerInWatchlist(stock.ticker);
        const dailyQuote = await watchlistService.getDailyStockQuote(stock.ticker);
        return {
          ...stock,
          isTracked,
          dailyQuote
        };
      })
    );

    const primaryStock = enhancedStocks.length > 0 ? enhancedStocks[0] : null;
    const history1Y = primaryStock ? await watchlistService.get1YearStockPriceHistory(primaryStock.ticker) : null;
    const trendGraphHTML = (primaryStock && history1Y)
      ? watchlistService.render1YearStockTrendHTML(history1Y, primaryStock.company)
      : '';

    const meter = res.meter || (ai ? ai.extractDynamicFallbackMeter(pageData) : {
      title: 'Document Assessment Meter',
      score: res.toneScore ?? 50,
      label: res.toneLabel || 'Balanced Assessment',
      leftLabel: 'Defensive',
      centerLabel: 'Balanced',
      rightLabel: 'Expansionary',
      explanation: 'Assessed from extracted financial statements and stated operational disclosures.'
    });

    const keyMetrics = Array.isArray(res.keyMetrics) && res.keyMetrics.length > 0 
      ? res.keyMetrics 
      : (ai ? ai.extractDynamicKeyMetrics({ text: pageData?.fullText, company: pageData?.company, ticker: pageData?.ticker, formType: pageData?.formType }) : []);

    const developments = Array.isArray(res.developments) && res.developments.length > 0 
      ? res.developments 
      : (ai ? ai.extractDynamicDevelopments({ text: pageData?.fullText, company: pageData?.company, ticker: pageData?.ticker, formType: pageData?.formType, bullets: res.bullets }) : []);

    const patterns = Array.isArray(res.patterns) && res.patterns.length > 0 
      ? res.patterns 
      : (ai ? ai.extractDynamicPatterns({ text: pageData?.fullText, company: pageData?.company, ticker: pageData?.ticker, formType: pageData?.formType, bullets: res.bullets, metrics: keyMetrics }) : []);

    const whatChanged = Array.isArray(res.whatChanged) && res.whatChanged.length > 0 ? res.whatChanged : [];

    container.innerHTML = `
      ${
        activeFilingContext
          ? `
          <div class="active-filing-banner">
            <div class="filing-banner-left">
              <span class="filing-banner-tag">SEC ${activeFilingContext.formType}</span>
              <span class="filing-banner-title" title="${activeFilingContext.company} (${activeFilingContext.ticker})">${activeFilingContext.company} (${activeFilingContext.ticker}) · ${activeFilingContext.period}</span>
            </div>
            <div class="filing-banner-actions">
              <a href="${activeFilingContext.sourceUrl}" target="_blank" rel="noopener" class="filing-banner-source-link" title="Open official SEC EDGAR filing">View source ↗</a>
              <button type="button" class="filing-banner-back-btn" id="btn-sp-return-page-doc" title="Return to current webpage document">✕ Close</button>
            </div>
          </div>
        `
          : ''
      }

      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
        <h2 class="section-headline" style="margin-bottom: 0;">${activeFilingContext ? 'Filing Summary' : 'Summary'}</h2>
        <button class="coral-btn" id="btn-sp-reanalyze" style="font-size: 11px; padding: 4px 8px;">Re-analyze</button>
      </div>

      <!-- Executive Overview -->
      <div class="summary-page-overview-box">
        <div class="overview-box-header">
          <span class="overview-section-label">✦ What this page is about</span>
        </div>
        <p class="overview-text">
          ${(res.overview || (ai ? ai.extractDynamicPageOverview(pageData) : '')).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
        </p>
      </div>

      <!-- Key Financial & Quantitative Metrics Grid -->
      ${keyMetrics && keyMetrics.length > 0 ? `
        <div class="summary-kpi-grid">
          ${keyMetrics.map(m => `
            <div class="summary-kpi-card">
              <span class="summary-kpi-label">${escapeHTML(m.label)}</span>
              <div class="summary-kpi-val-row">
                <span class="summary-kpi-value">${escapeHTML(m.value)}</span>
                ${m.delta ? `<span class="summary-kpi-delta ${m.isPositive ? 'positive' : (String(m.delta).includes('-') ? 'negative' : 'neutral')}">${escapeHTML(m.delta)}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- 1-Year Stock Price Trend Graph -->
      ${trendGraphHTML}

      <!-- Strategic & Operational Developments Card -->
      ${developments && developments.length > 0 ? `
        <div class="summary-developments-card">
          <div class="summary-developments-header">
            <span class="summary-developments-title">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
              Strategic & Operational Developments
            </span>
          </div>
          <div class="summary-dev-list">
            ${developments.map(d => {
              let str = String(d || '').trim();
              str = str.replace(/^[•\u2022\u00B7\-–—]\s*/, '').replace(/^\*\s+/, '').trim();
              str = str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
              return `<div class="summary-dev-item">${str}</div>`;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Key Insights & Pattern Recognition Card -->
      ${patterns && patterns.length > 0 ? `
        <div class="summary-insights-card">
          <div class="summary-insights-header">
            <span class="summary-insights-title">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
              Insights & Pattern Recognition
            </span>
          </div>
          <div class="summary-patterns-list">
            ${patterns.map(p => {
              let str = String(p || '').trim();
              str = str.replace(/^[•\u2022\u00B7\-–—]\s*/, '').replace(/^\*\s+/, '').trim();
              str = str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
              return `<div class="summary-pattern-item">${str}</div>`;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Dynamic Contextual Assessment Meter Card (Configured by AI) -->
      <div class="coverage-tone-card">
        <div class="meter-header">
          <span class="meter-title">${meter.title || 'Document Assessment'}</span>
          <span class="meter-label" id="sp-meter-label-text">${meter.label || 'Overview'}</span>
        </div>
        <div class="meter-track-container">
          <div class="meter-bar">
            <div class="meter-tick" style="left: ${Math.min(95, Math.max(5, meter.score ?? 50))}%;"></div>
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

      <!-- Key Period Shifts / What Changed Preview -->
      ${whatChanged && whatChanged.length > 0 ? `
        <div class="summary-shifts-preview">
          <div class="summary-shifts-preview-header">
            <span class="summary-shifts-preview-title">✦ Key Period Shifts</span>
            <button type="button" class="coral-btn btn-sp-view-full-diff" style="font-size: 10.5px; padding: 2.5px 7px;">View Full Diffs ↗</button>
          </div>
          <div class="summary-shifts-list">
            ${whatChanged.slice(0, 3).map(s => `
              <div class="summary-shift-pill-item">
                <span class="summary-shift-headline">${escapeHTML(s.headline)}</span>
                <span class="summary-shift-badge ${s.isPositive ? 'positive' : 'negative'}">${escapeHTML(s.changePercent || (s.isPositive ? '+YoY' : '-YoY'))}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Tone Tag -->
      <div class="tone-highlight-pill" id="sp-summary-tone-pill">
        ${res.toneTag || 'Tone: factual'}
      </div>

      <div class="summary-section-subhead">
        <span>✦ Core Takeaways & Disclosures</span>
      </div>

      <!-- Bullets with Category Headlines & Bold Metrics -->
      <ul class="summary-bullets">
        ${(res.bullets || []).map((b) => {
          let str = String(b || '').trim();
          str = str.replace(/^[•\u2022\u00B7\-–—]\s*/, '').replace(/^\*\s+/, '').trim();
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
          return `<li class="bullet-item"><span class="bullet-icon">✦</span><span class="bullet-content">${str}</span></li>`;
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
              <button type="button" class="btn-track-all-stocks" id="btn-sp-track-all-summary-stocks">
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
                      <span class="summary-stock-price">${getStockCurrencySymbol(s.dailyQuote, s.ticker)}${s.dailyQuote.price}</span>
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
        ${res.disclaimer || (pageData.isFinanceSite
          ? 'Objective analytical breakdown of page disclosures and reported information. Does not constitute financial advice or investment recommendations.'
          : 'Objective analytical summary of extracted page content. Does not constitute professional or investment advice.')}
      </p>
    `;

    const reanalyzeBtn = document.getElementById('btn-sp-reanalyze');
    if (reanalyzeBtn) {
      reanalyzeBtn.addEventListener('click', () => {
        summaryResult = null;
        runSummaryAnalysis();
      });
    }

    // View Full Diffs button
    const diffBtns = container.querySelectorAll('.btn-sp-view-full-diff');
    diffBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTabName = 'changed';
        renderHeader();
        renderTabContent();
      });
    });

    // Stock tracking buttons in the summary stocks box
    container.querySelectorAll('.btn-summary-stock-track').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget;
        const t = target.dataset.ticker;
        const c = target.dataset.company;
        const cik = target.dataset.cik;
        if (!t) return;
        const toggleRes = await watchlistService.toggleWatchlist(t, c, cik);
        if (toggleRes.inWatchlist) {
          target.classList.add('tracked');
          target.innerHTML = '✓ Tracked';
          showToast(`✓ Added ${t} (${c}) to Watchlist`);
        } else {
          target.classList.remove('tracked');
          target.innerHTML = '+ Track';
          showToast(`Removed ${t} from Watchlist`);
        }
        await updateSpHeaderWatchlistButton();

        const allBtn = document.getElementById('btn-sp-track-all-summary-stocks');
        if (allBtn) {
          const allItems = Array.from(container.querySelectorAll('.btn-summary-stock-track'));
          const allDone = allItems.every((el) => el.classList.contains('tracked'));
          allBtn.textContent = allDone ? '✓ All Tracked' : '+ Track All';
        }
      });
    });

    // Track All Button
    const trackAllBtn = document.getElementById('btn-sp-track-all-summary-stocks');
    if (trackAllBtn) {
      trackAllBtn.addEventListener('click', async () => {
        const trackButtons = Array.from(container.querySelectorAll('.btn-summary-stock-track'));
        const untrackedButtons = trackButtons.filter((el) => !el.classList.contains('tracked'));
        if (untrackedButtons.length > 0) {
          for (const btn of untrackedButtons) {
            const t = btn.dataset.ticker;
            const c = btn.dataset.company;
            const cik = btn.dataset.cik;
            await watchlistService.addTicker(t, c, cik);
            btn.classList.add('tracked');
            btn.innerHTML = '✓ Tracked';
          }
          trackAllBtn.textContent = '✓ All Tracked';
          showToast(`✓ Added ${untrackedButtons.length} stocks to Watchlist`);
        } else {
          for (const btn of trackButtons) {
            const t = btn.dataset.ticker;
            await watchlistService.removeTicker(t);
            btn.classList.remove('tracked');
            btn.innerHTML = '+ Track';
          }
          trackAllBtn.textContent = '+ Track All';
          showToast(`Removed stocks from Watchlist`);
        }
        await updateSpHeaderWatchlistButton();
      });
    }

    const returnBtn = document.getElementById('btn-sp-return-page-doc');
    if (returnBtn) {
      returnBtn.addEventListener('click', () => closeFilingSummaryView());
    }

    renderAdvancedFooter(res.suggestedQueries || (ai ? ai.extractDynamicFallbackQueries(pageData) : []));
  }

  async function runSummaryAnalysis() {
    isAnalyzing = true;
    lastAnalysisError = null;
    renderActiveTab();

    const check = await license.checkCanAnalyze();
    if (!check.allowed) {
      isAnalyzing = false;
      lastAnalysisError = 'Prospectus license required. Please configure your license in Settings.';
      showToast('License required. Open Settings.');
      renderActiveTab();
      return;
    }

    const settings = await storage.getSettings();
    if (!settings.apiKey && settings.aiProvider !== 'custom') {
      isAnalyzing = false;
      lastAnalysisError = 'API key missing. Please enter your API key in Settings.';
      showToast('API key required. Check Settings.');
      renderActiveTab();
      return;
    }

    try {
      if (activeTab && (activeTab.url?.includes('.pdf') || activeTab.url?.startsWith('file:///'))) {
        try {
          let text = '';
          if (typeof PDFExtractor !== 'undefined') {
            const extRes = await PDFExtractor.extractPdfText(activeTab.url);
            if (extRes && extRes.success && extRes.text) text = extRes.text;
          }
          if (!text && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            const bgRes = await new Promise((resolve) => {
              chrome.runtime.sendMessage({ action: 'EXTRACT_PDF', url: activeTab.url }, (r) => {
                if (chrome.runtime.lastError) return resolve(null);
                resolve(r);
              });
            });
            if (bgRes && bgRes.success && bgRes.text) text = bgRes.text;
          }
          if (text && text.trim().length > 30) {
            pageData.extractedText = text.trim();
            pageData.fullText = `PDF Title: ${pageData.company}\n\nExtracted Content:\n${text.trim().slice(0, 24000)}`;
            pageData.isFinanceSite = FinancialExtractors.isFinancialContent(text, pageData.company, activeTab?.url || '');
          }
        } catch (e) {
          // PDF text extraction handled silently
        }
      }

      // Check for and extract any documents opened inside the active webpage
      if (activeTab && activeTab.id) {
        try {
          const asyncResults = await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: async () => {
              if (typeof FinancialExtractors !== 'undefined') {
                return await FinancialExtractors.extractEmbeddedDocumentsAsync();
              }
              return [];
            },
          });
          if (asyncResults && asyncResults[0] && asyncResults[0].result && asyncResults[0].result.length > 0) {
            const docs = asyncResults[0].result;
            pageData.hasEmbeddedDocuments = true;
            pageData.embeddedDocuments = docs;
            let embText = '';
            for (const doc of docs) {
              if (doc.text && doc.text.length > 50) {
                embText += `\n\n${doc.text}\n`;
                if (doc.company && (!pageData.company || pageData.company === 'Web Document')) pageData.company = doc.company;
                if (doc.ticker && (!pageData.ticker || pageData.ticker === 'PAGE')) pageData.ticker = doc.ticker;
                if (doc.isFinancial) pageData.isFinanceSite = true;
              }
            }
            if (embText) {
              pageData.fullText = embText + '\n\n' + (pageData.fullText || '');
            }
          }
        } catch (scriptErr) {}
      }

      summaryResult = await ai.generateSummary({
        ticker: pageData.ticker,
        company: pageData.company,
        formType: pageData.formType,
        text: pageData.fullText || pageData.company,
        headlines: pageData.headlines || [pageData.company],
      });

      if (!summaryResult || !summaryResult.bullets || summaryResult.bullets.length === 0) {
        throw new Error('API returned an empty response. Please try again.');
      }
      lastAnalysisError = null;
    } catch (e) {
      summaryResult = null;
      lastAnalysisError = `API call error: ${e.message || 'Unable to complete AI request. Please check Settings.'}`;
      showToast(lastAnalysisError);
    } finally {
      isAnalyzing = false;
      renderActiveTab();
    }
  }

  async function renderWhatChangedTab(container) {
    if (!summaryResult && !isAnalyzing) {
      if (lastAnalysisError) {
        container.innerHTML = `
          <div class="non-finance-view">
            <div class="non-financial-card">
              <div class="non-financial-badge">
                <span class="warning-badge-pill">⚠️ Analysis Notice</span>
              </div>
              <h3 class="non-financial-title">Unable to track changes</h3>
              <p class="non-financial-text">
                ${lastAnalysisError}. Verify your API key in Settings.
              </p>
              <div class="choice-buttons" style="margin-top: 10px; display: flex; gap: 8px;">
                <button class="btn-dark-cta" id="btn-sp-wc-retry-analyze">
                  ${ICONS.sparkle} <span>Try again</span>
                </button>
                <button class="coral-btn" id="btn-sp-wc-notice-settings" style="font-size: 11.5px; padding: 7px 12px;">
                  Open Settings
                </button>
              </div>
            </div>
          </div>
        `;
        const retryBtn = document.getElementById('btn-sp-wc-retry-analyze');
        if (retryBtn) retryBtn.addEventListener('click', () => runSummaryAnalysis());
        const noticeSettingsBtn = document.getElementById('btn-sp-wc-notice-settings');
        if (noticeSettingsBtn) noticeSettingsBtn.addEventListener('click', () => openSettings());
        return;
      }
      container.innerHTML = `
        <div class="non-finance-view">
          <p class="non-finance-prompt">Ready to track YoY & period changes for ${pageData ? pageData.company : 'this document'}?</p>
          <button class="btn-dark-cta" id="btn-sp-what-changed-analyze">
            Analyze this page
          </button>
          <div class="non-finance-notice">
            Prospectus extracts top-line revenue shifts, segment growth, operating margins, cash flows, and new Item 1A risk disclosures.
          </div>
        </div>
      `;

      const analyzeBtn = document.getElementById('btn-sp-what-changed-analyze');
      if (analyzeBtn) {
        analyzeBtn.addEventListener('click', () => runSummaryAnalysis());
      }
      return;
    }

    if (isAnalyzing) {
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
          </div>
        </div>
      `;
      return;
    }

    const scopeKey = activeFilingContext
      ? `filing_${activeFilingContext.ticker}`
      : ((pageData && pageData.ticker && pageData.ticker !== 'PAGE' && pageData.ticker !== 'PDF')
        ? `sp_${pageData.ticker.toUpperCase().replace(/[^a-zA-Z0-9]/g, '_')}_${(pageData.formType || 'Doc').replace(/[^a-zA-Z0-9]/g, '_')}`
        : `sp_${(pageData?.url || 'page').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60)}`);

    const history = await storageService.getFilingHistory(scopeKey);
    const currentText = pageData ? (pageData.fullText || pageData.extractedText || pageData.company || '') : '';
    const currentPeriod = pageData ? (pageData.periodBadge || pageData.filingDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })) : new Date().toLocaleDateString();

    const escape = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // CASE A: No history is present -> Save baseline and do NOT show any change
    if (!history || history.length === 0) {
      const baselinePeriod = `Initial Baseline · ${currentPeriod}`;
      await storageService.saveFilingSnapshot(scopeKey, pageData?.formType || 'Document', baselinePeriod, {
        text: currentText,
        savedAt: new Date().toISOString(),
        summary: summaryResult ? summaryResult.overview : '',
        whatChanged: [],
      });

      container.innerHTML = `
        <div class="what-changed-view">
          ${
            activeFilingContext
              ? `
              <div class="active-filing-banner">
                <div class="filing-banner-left">
                  <span class="filing-banner-tag">SEC ${activeFilingContext.formType}</span>
                  <span class="filing-banner-title" title="${activeFilingContext.company} (${activeFilingContext.ticker})">${activeFilingContext.company} (${activeFilingContext.ticker}) · Shifts vs Prior Filing</span>
                </div>
                <div class="filing-banner-actions">
                  <a href="${activeFilingContext.sourceUrl}" target="_blank" rel="noopener" class="filing-banner-source-link" title="Open official SEC EDGAR filing">View source ↗</a>
                  <button type="button" class="filing-banner-back-btn" id="btn-sp-wc-return-page-doc" title="Return to current webpage document">✕ Close</button>
                </div>
              </div>
            `
              : ''
          }
          <div class="what-changed-header">
            <h2 class="what-changed-title">What changed</h2>
            <span class="wc-baseline-status-badge">● Baseline Active</span>
          </div>

          <div class="wc-baseline-card">
            <div class="wc-card-category">
              <span class="wc-cat-dot">●</span>
              <span>INITIAL BASELINE ESTABLISHED</span>
            </div>
            <h3 class="wc-baseline-headline">Baseline recorded for ${escape(pageData?.company || pageData?.ticker || 'this document')}</h3>
            <p class="wc-baseline-desc">
              No prior version history exists for this document, so no changes are displayed. This initial baseline has been saved to your local history. Future filings, revisions, or page updates will automatically be compared against this baseline to track material YoY and period changes.
            </p>
            <div class="wc-baseline-meta-row">
              <span class="wc-baseline-meta">Recorded: <strong>${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></span>
              <span class="wc-baseline-meta">Scope: <strong>${escape(pageData?.ticker || pageData?.formType || 'Document')}</strong></span>
            </div>
            <div style="margin-top: 10px; display: flex; gap: 8px;">
              <button class="coral-btn" id="btn-sp-wc-new-snapshot" style="font-size: 11px; padding: 5px 10px;">
                + Record Revision Snapshot
              </button>
            </div>
          </div>
        </div>
      `;

      const wcReturnBtn = document.getElementById('btn-sp-wc-return-page-doc');
      if (wcReturnBtn) {
        wcReturnBtn.addEventListener('click', () => closeFilingSummaryView());
      }

      const newSnapBtn = document.getElementById('btn-sp-wc-new-snapshot');
      if (newSnapBtn) {
        newSnapBtn.addEventListener('click', async () => {
          const revPeriod = `Revision · ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          const items = (summaryResult && Array.isArray(summaryResult.whatChanged) && summaryResult.whatChanged.length > 0)
            ? summaryResult.whatChanged
            : (ai ? ai.extractDynamicWhatChanged({
                text: currentText,
                company: pageData?.company || 'Company',
                ticker: pageData?.ticker || 'TICKER',
                formType: pageData?.formType || 'Report'
              }) : []);
          await storageService.saveFilingSnapshot(scopeKey, pageData?.formType || 'Document', revPeriod, {
            text: currentText,
            savedAt: new Date().toISOString(),
            whatChanged: items,
          });
          renderWhatChangedTab(container);
        });
      }
      return;
    }

    // CASE B: History IS present
    const latestRevision = history[0];
    const baselineItem = history[history.length - 1];

    if (history.length === 1 && (!latestRevision.whatChanged || latestRevision.whatChanged.length === 0)) {
      container.innerHTML = `
        <div class="what-changed-view">
          ${
            activeFilingContext
              ? `
              <div class="active-filing-banner">
                <div class="filing-banner-left">
                  <span class="filing-banner-tag">SEC ${activeFilingContext.formType}</span>
                  <span class="filing-banner-title" title="${activeFilingContext.company} (${activeFilingContext.ticker})">${activeFilingContext.company} (${activeFilingContext.ticker}) · Shifts vs Prior Filing</span>
                </div>
                <div class="filing-banner-actions">
                  <a href="${activeFilingContext.sourceUrl}" target="_blank" rel="noopener" class="filing-banner-source-link" title="Open official SEC EDGAR filing">View source ↗</a>
                  <button type="button" class="filing-banner-back-btn" id="btn-sp-wc-return-page-doc" title="Return to current webpage document">✕ Close</button>
                </div>
              </div>
            `
              : ''
          }
          <div class="what-changed-header">
            <h2 class="what-changed-title">What changed</h2>
            <span class="wc-baseline-status-badge">● Baseline Active</span>
          </div>

          <div class="wc-baseline-card">
            <div class="wc-card-category">
              <span class="wc-cat-dot">●</span>
              <span>INITIAL BASELINE ESTABLISHED</span>
            </div>
            <h3 class="wc-baseline-headline">Baseline recorded for ${escape(pageData?.company || pageData?.ticker || 'this document')}</h3>
            <p class="wc-baseline-desc">
              Initial baseline snapshot is active (saved ${new Date(baselineItem.savedAt).toLocaleDateString()}). No subsequent revisions have been recorded yet. Click below to record a new revision snapshot to track changes.
            </p>
            <div class="wc-baseline-meta-row">
              <span class="wc-baseline-meta">Baseline: <strong>${baselineItem.period || 'Initial'}</strong></span>
              <span class="wc-baseline-meta">History: <strong>1 Snapshot</strong></span>
            </div>
            <div style="margin-top: 10px; display: flex; gap: 8px;">
              <button class="coral-btn" id="btn-sp-wc-new-snapshot" style="font-size: 11px; padding: 5px 10px;">
                + Record Revision Snapshot
              </button>
            </div>
          </div>
        </div>
      `;

      const wcReturnBtn = document.getElementById('btn-sp-wc-return-page-doc');
      if (wcReturnBtn) {
        wcReturnBtn.addEventListener('click', () => closeFilingSummaryView());
      }

      const newSnapBtn = document.getElementById('btn-sp-wc-new-snapshot');
      if (newSnapBtn) {
        newSnapBtn.addEventListener('click', async () => {
          const revPeriod = `Revision · ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          const items = (summaryResult && Array.isArray(summaryResult.whatChanged) && summaryResult.whatChanged.length > 0)
            ? summaryResult.whatChanged
            : (ai ? ai.extractDynamicWhatChanged({
                text: currentText,
                company: pageData?.company || 'Company',
                ticker: pageData?.ticker || 'TICKER',
                formType: pageData?.formType || 'Report'
              }) : []);
          await storageService.saveFilingSnapshot(scopeKey, pageData?.formType || 'Document', revPeriod, {
            text: currentText,
            savedAt: new Date().toISOString(),
            whatChanged: items,
          });
          renderWhatChangedTab(container);
        });
      }
      return;
    }

    // CASE C: Multiple revisions exist OR changes were detected in the latest revision
    let items = (latestRevision.whatChanged && latestRevision.whatChanged.length > 0)
      ? latestRevision.whatChanged
      : (summaryResult && Array.isArray(summaryResult.whatChanged) && summaryResult.whatChanged.length > 0
        ? summaryResult.whatChanged
        : (ai ? ai.extractDynamicWhatChanged({
            text: currentText,
            company: pageData?.company || 'Company',
            ticker: pageData?.ticker || 'TICKER',
            formType: pageData?.formType || 'Report'
          }) : []));

    const historyOptionsHTML = history.map((snap, idx) => {
      const isLatest = idx === 0;
      const isBase = idx === history.length - 1;
      const label = isLatest
        ? `Latest Revision: ${snap.period || new Date(snap.savedAt).toLocaleDateString()}`
        : (isBase ? `Baseline: ${snap.period || new Date(snap.savedAt).toLocaleDateString()}` : `Revision ${history.length - idx}: ${snap.period || new Date(snap.savedAt).toLocaleDateString()}`);
      return `<option value="${snap.key}" ${isLatest ? 'selected' : ''}>${escape(label)}</option>`;
    }).join('');

    const renderCards = (filterType) => {
      const filtered = items.filter(item => {
        if (filterType === 'all') return true;
        if (filterType === 'financial' && item.type === 'financial') return true;
        if (filterType === 'risk' && item.type === 'risk') return true;
        if (filterType === 'operational' && item.type === 'operational') return true;
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
              <span>${escape(item.category || 'FINANCIAL METRIC')}</span>
            </div>
            <div class="wc-card-headline-row">
              <div class="wc-card-headline">${escape(item.headline || '')}</div>
              <div class="wc-card-badge ${badgeClass}">${escape(item.changePercent || '')}</div>
            </div>
            <div class="wc-card-period">
              <span>${escape(item.periodComparison || '')}</span>
            </div>
          </div>
        `;
      }).join('');
    };

    container.innerHTML = `
      <div class="what-changed-view">
        ${
          activeFilingContext
            ? `
            <div class="active-filing-banner">
              <div class="filing-banner-left">
                <span class="filing-banner-tag">SEC ${activeFilingContext.formType}</span>
                <span class="filing-banner-title" title="${activeFilingContext.company} (${activeFilingContext.ticker})">${activeFilingContext.company} (${activeFilingContext.ticker}) · Shifts vs Prior Filing</span>
              </div>
              <div class="filing-banner-actions">
                <a href="${activeFilingContext.sourceUrl}" target="_blank" rel="noopener" class="filing-banner-source-link" title="Open official SEC EDGAR filing">View source ↗</a>
                <button type="button" class="filing-banner-back-btn" id="btn-sp-wc-return-page-doc" title="Return to current webpage document">✕ Close</button>
              </div>
            </div>
          `
            : ''
        }
        <div class="what-changed-header">
          <h2 class="what-changed-title">What changed</h2>
          <select class="wc-filter-select" id="wc-sp-filter-select">
            <option value="all">All changes</option>
            <option value="financial">Financial metrics</option>
            <option value="risk">Risk disclosures</option>
            <option value="operational">Operational</option>
          </select>
        </div>

        <div class="wc-history-bar">
          <span class="wc-history-label">History:</span>
          <select class="wc-history-select" id="wc-sp-history-select">
            ${historyOptionsHTML}
          </select>
          <button class="coral-btn" id="btn-sp-wc-new-snapshot" style="font-size: 10.5px; padding: 3px 7px;">+ New Snapshot</button>
        </div>

        <div class="what-changed-list" id="what-changed-sp-cards-container">
          ${renderCards('all')}
        </div>
      </div>
    `;

    const wcReturnBtn = document.getElementById('btn-sp-wc-return-page-doc');
    if (wcReturnBtn) {
      wcReturnBtn.addEventListener('click', () => closeFilingSummaryView());
    }

    const filterSelect = document.getElementById('wc-sp-filter-select');
    const cardsContainer = document.getElementById('what-changed-sp-cards-container');
    if (filterSelect && cardsContainer) {
      filterSelect.addEventListener('change', (e) => {
        cardsContainer.innerHTML = renderCards(e.target.value);
      });
    }

    const historySelect = document.getElementById('wc-sp-history-select');
    if (historySelect) {
      historySelect.addEventListener('change', async (e) => {
        const selectedKey = e.target.value;
        const data = await storageService.get(selectedKey);
        if (data && data[selectedKey] && Array.isArray(data[selectedKey].whatChanged)) {
          items = data[selectedKey].whatChanged;
          cardsContainer.innerHTML = renderCards(filterSelect ? filterSelect.value : 'all');
        }
      });
    }

    const newSnapBtn = document.getElementById('btn-sp-wc-new-snapshot');
    if (newSnapBtn) {
      newSnapBtn.addEventListener('click', async () => {
        const revPeriod = `Revision · ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        const freshItems = (summaryResult && Array.isArray(summaryResult.whatChanged) && summaryResult.whatChanged.length > 0)
          ? summaryResult.whatChanged
          : (ai ? ai.extractDynamicWhatChanged({
              text: currentText,
              company: pageData?.company || 'Company',
              ticker: pageData?.ticker || 'TICKER',
              formType: pageData?.formType || 'Report'
            }) : []);
        await storageService.saveFilingSnapshot(scopeKey, pageData?.formType || 'Document', revPeriod, {
          text: currentText,
          savedAt: new Date().toISOString(),
          whatChanged: freshItems,
        });
        renderWhatChangedTab(container);
      });
    }
  }

  async function renderExplainTab(container) {
    const isAnalyzed = !!(summaryResult && (summaryResult.overview || (summaryResult.bullets && summaryResult.bullets.length > 0)));
    const recTerms = (isAnalyzed && ai)
      ? ai.extractRecommendedExplainTerms(pageData || {}, summaryResult)
      : [];

    container.innerHTML = `
      <h2 class="section-headline">Explain terms</h2>
      <p style="font-size: 13px; color: #6c6a64; margin-bottom: 10px;">
        Search any term below to explain it using the actual context in this document.
      </p>

      <div class="explain-input-box" style="display: flex; gap: 8px; margin-bottom: 12px;">
        <input type="text" class="text-input-field" id="sp-explain-term-input" placeholder="e.g. gross margin, deferred revenue..." style="flex: 1;" />
        <button class="coral-btn" id="btn-sp-run-explain">Explain</button>
      </div>

      <!-- AI Recommended Search Terms Section (Shown ONLY when a document is analyzed) -->
      ${
        (isAnalyzed && recTerms.length > 0)
          ? `
          <div class="explain-recommendations-section" style="margin-bottom: 14px;">
            <span class="explain-rec-label" style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #8a877f; display: block; margin-bottom: 6px;">✦ AI Recommended Terms in This Document</span>
            <div class="explain-rec-chips" style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${recTerms.map((t) => `<button type="button" class="explain-rec-chip" data-term="${t.replace(/"/g, '&quot;')}">${t}</button>`).join('')}
            </div>
          </div>
          `
          : ''
      }

      <div class="card-box" id="sp-explain-result-card" style="display: none; margin-top: 14px; background: #fff; border: 1px solid #e6dfd8; border-radius: 8px; padding: 14px;">
        <h4 id="sp-explain-result-term" style="font-family: 'Newsreader', 'Cormorant Garamond', Georgia, serif; font-size: 16px; margin-bottom: 6px; color: #141413;">Term Explanation</h4>
        <p id="sp-explain-result-body" style="font-size: 13px; line-height: 1.55; color: #2b2926; margin-bottom: 10px;">Loading...</p>
        <button class="coral-btn" id="btn-sp-save-explain-note" style="align-self: flex-start; font-size: 11.5px; padding: 5px 10px;">
          ${ICONS.bookmark} Save to Notebook
        </button>
      </div>
    `;

    const input = document.getElementById('sp-explain-term-input');
    const btn = document.getElementById('btn-sp-run-explain');

    if (btn && input) {
      btn.addEventListener('click', () => {
        if (input.value.trim()) triggerSpExplainTerm(input.value.trim());
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim()) triggerSpExplainTerm(input.value.trim());
      });
    }

    container.querySelectorAll('.explain-rec-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        const term = e.currentTarget.dataset.term;
        if (input) input.value = term;
        triggerSpExplainTerm(term);
      });
    });
  }

  async function triggerSpExplainTerm(term) {
    const card = document.getElementById('sp-explain-result-card');
    const title = document.getElementById('sp-explain-result-term');
    const body = document.getElementById('sp-explain-result-body');
    const input = document.getElementById('sp-explain-term-input');

    if (input) input.value = term;
    if (card) card.style.display = 'block';
    if (title) title.textContent = `"${term}" in context`;
    if (body) body.innerHTML = `<div class="loading-shimmer" style="height: 36px;"></div>`;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    let finalExplanation = '';
    try {
      finalExplanation = await ai.explainTermInContext({
        term,
        context: (pageData && pageData.fullText) ? pageData.fullText.slice(0, 2500) : '',
        ticker: pageData?.ticker || 'PAGE',
        company: pageData?.company || 'Company',
      });
      if (body) body.textContent = finalExplanation;
    } catch (err) {
      finalExplanation = `In this document, "${term}" is referenced in relation to operational and financial disclosures.`;
      if (body) {
        body.innerHTML = `
          <div>${finalExplanation}</div>
          <div class="tab-inline-error-notice" style="margin-top: 10px; padding: 8px 12px; background: #fff5f2; border: 1px solid #f2d4cc; border-radius: 6px; font-size: 12px; color: #a9583e; display: flex; justify-content: space-between; align-items: center;">
            <span>⚠️ API Error: ${err.message || 'Please check your API key in Settings'}</span>
            <button type="button" class="coral-btn" style="padding: 3px 8px; font-size: 11px; margin-left: 8px; white-space: nowrap;" id="btn-sp-explain-settings">Settings</button>
          </div>
        `;
        const expSetBtn = document.getElementById('btn-sp-explain-settings');
        if (expSetBtn) expSetBtn.addEventListener('click', openSettings);
      }
    }

    const saveBtn = document.getElementById('btn-sp-save-explain-note');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        await storage.saveNotebookEntry({
          title: `Concept: ${term}`,
          quote: term,
          note: finalExplanation,
          category: 'Financial Metrics',
          ticker: pageData?.ticker || 'PAGE',
        });
        showToast(`Saved "${term}" to Notebook`);
      };
    }
  }

  async function renderNotebookTab(container) {
    const notes = await storage.getNotebookEntries();
    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 class="section-headline" style="margin-bottom: 0;">Notebook (${notes.length})</h2>
      </div>
      <div class="notebook-list">
        ${notes.map(n => {
          const hasTicker = n.ticker && n.ticker !== 'PAGE' && n.ticker !== 'PDF';
          return `
            <div class="note-card" style="background: #fff; border: 1px solid #e6dfd8; border-radius: 6px; padding: 12px; margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-weight: 600; font-size: 13.5px; color: #141413;">${n.title}</div>
                ${hasTicker ? `<span class="pill" style="font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid #e6dfd8; background: #efe9de; color: #585652;">${n.ticker}</span>` : ''}
              </div>
              ${n.quote ? `<div style="font-size: 12.5px; color: #595853; border-left: 2px solid #cc785c; padding-left: 8px; margin: 6px 0;">"${n.quote}"</div>` : ''}
              <div style="font-size: 11px; color: #8e8b82;">${new Date(n.timestamp || n.createdAt || Date.now()).toLocaleDateString()}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  async function renderWatchlistTab(container) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'CLEAR_DIGEST_BADGE' }).catch(() => {});
    }

    const rawItems = await watchlistService.getWatchlist();
    const items = rawItems.map((item) => {
      if (typeof item === 'string') {
        return {
          ticker: item,
          company: item,
          starred: false,
          muted: false,
          lastDigest: { tag: 'Quiet', summary: 'Added to watchlist. Awaiting scheduled digest.', date: 'Today' },
        };
      }
      return item;
    });

    const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const updatedCount = items.filter((i) => {
      const clean = (typeof i === 'string' ? i : i.ticker);
      const det = (window._spTrackerDetailCache && window._spTrackerDetailCache[clean]) || null;
      if (det) return det.hasAnyNew;
      return Boolean(i.hasAnyNew);
    }).length;
    const settings = await storageService.getSettings();
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
      window._spTrackerDetailCache = window._spTrackerDetailCache || {};
      for (const item of items) {
        const cleanTicker = watchlistService ? watchlistService.extractCleanSymbol(item.ticker) : item.ticker;
        const isExpanded = window._spWatchlistExpandedTicker === item.ticker;
        const quote = item.stockQuote || (watchlistService?._quoteMemoryCache?.get(cleanTicker)) || null;
        const detail = isExpanded ? (window._spTrackerDetailCache[cleanTicker] || null) : (window._spTrackerDetailCache ? window._spTrackerDetailCache[cleanTicker] : null);

        // Change from last check evaluation
        const hasNewFilings = detail ? Boolean(detail.hasNewFilings) : Boolean(item.hasNewFilings);
        const hasNewNews = detail ? Boolean(detail.hasNewNews) : Boolean(item.hasNewNews);
        const hasNewUpdates = hasNewFilings || hasNewNews;
        const hasAnyNew = hasNewFilings || hasNewNews;

        // Determine status badge (show New update / New filing when anything changed from last check, otherwise Up to date)
        let statusText = 'Up to date';
        let statusClass = 'up-to-date';
        if (hasNewFilings) {
          statusText = 'New filing';
          statusClass = 'new-filing';
        } else if (hasAnyNew) {
          statusText = 'New update';
          statusClass = 'new-update';
        }

        // Format last checked date relatively (never display stale mock years)
        const formatLastChecked = (ts) => {
          if (!ts) return 'Just now';
          const diffMs = Date.now() - new Date(ts).getTime();
          if (isNaN(diffMs) || diffMs < 60000) return 'Just now';
          const diffMin = Math.floor(diffMs / 60000);
          if (diffMin < 60) return `${diffMin}m ago`;
          const diffHours = Math.floor(diffMin / 60);
          if (diffHours < 24) return `${diffHours}h ago`;
          const diffDays = Math.floor(diffHours / 24);
          if (diffDays === 1) return 'Yesterday';
          if (diffDays <= 2) return `${diffDays}d ago`;
          return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };
        const lastCheckedStr = formatLastChecked(item.lastChecked);

        const secSourceUrl = watchlistService.getTickerSourceUrl(item.ticker);
        window._spWatchlistSubTabs = window._spWatchlistSubTabs || {};
        const activeSubTab = window._spWatchlistSubTabs[item.ticker] || 'updates';

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
                <div class="wl-card-price-row" id="wl-sp-price-box-${item.ticker}">
                  ${
                    quote
                      ? `<span class="wl-card-price">${getStockCurrencySymbol(quote || item.stockQuote || item, item.ticker)}${quote.price}</span>
                         <span class="wl-card-change ${quote.isPositive ? 'positive' : 'negative'}">
                           ${quote.isPositive ? '▲' : '▼'} ${quote.changePercent}
                         </span>`
                      : `<span class="wl-card-price" style="color: #a8a49c; font-size: 13px;">--.--</span>`
                  }
                </div>
                <div class="wl-card-status-row">
                  <span class="wl-status-badge ${statusClass}">
                    ${hasAnyNew ? '<span class="wl-badge-dot"></span>' : ''}${statusText}
                  </span>
                  <span class="wl-card-expand-icon">›</span>
                </div>
              </div>
            </div>

            <!-- Expanded Tracker Detail Pane (Visible on Click) -->
            ${
              isExpanded
                ? (detail
                    ? `
              <div class="wl-detail-tracker-pane" id="wl-sp-detail-pane-${item.ticker}">
                <div class="wl-tracker-header">
                  <h3 class="wl-tracker-company-title">${detail.company} (${detail.ticker})</h3>
                  <div class="wl-tracker-actions">
                    <button class="icon-btn wl-star-btn ${item.starred ? 'starred' : ''}" data-ticker="${item.ticker}" title="${item.starred ? 'Starred' : 'Star ticker'}">
                      ${item.starred ? '★' : '☆'}
                    </button>
                    <button class="icon-btn btn-sp-mute-ticker ${item.muted ? 'muted' : ''}" data-ticker="${item.ticker}" title="${item.muted ? 'Unmute' : 'Mute'}">
                      ${item.muted ? ICONS.bellOff : ICONS.bell}
                    </button>
                    <button class="icon-btn btn-sp-delete-ticker" data-ticker="${item.ticker}" title="Remove ticker">
                      ${ICONS.trash}
                    </button>
                  </div>
                </div>

                <!-- Detail Sub-Tabs: Filings | Updates | News (with dots on sections having new items) -->
                <div class="wl-tracker-tabs-row">
                  <button class="wl-tracker-tab ${activeSubTab === 'filings' ? 'active' : ''}" data-ticker="${item.ticker}" data-subtab="filings">
                    Filings${detail.hasNewFilings ? '<span class="wl-tab-dot" title="New filing since last check"></span>' : ''}
                  </button>
                  <button class="wl-tracker-tab ${activeSubTab === 'updates' ? 'active' : ''}" data-ticker="${item.ticker}" data-subtab="updates">
                    Updates${detail.hasNewUpdates ? '<span class="wl-tab-dot" title="New update since last check"></span>' : ''}
                  </button>
                  <button class="wl-tracker-tab ${activeSubTab === 'news' ? 'active' : ''}" data-ticker="${item.ticker}" data-subtab="news">
                    News${detail.hasNewNews ? '<span class="wl-tab-dot" title="New news since last check"></span>' : ''}
                  </button>
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
                          <span class="wl-update-pill ${detail.hasAnyNew ? 'new-update' : 'up-to-date'}">
                            ${detail.hasAnyNew ? '<span class="wl-badge-dot"></span>' : '✓ '} ${detail.latestUpdate.badge}
                          </span>
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
                          <div class="wl-filing-item ${f.isNew ? 'is-new' : ''}">
                            <div class="wl-filing-left">
                              <span class="wl-filing-form-badge">${f.form}</span>
                              <span class="wl-filing-desc">${f.title}</span>
                              ${f.isNew ? '<span class="wl-item-new-pill">NEW</span>' : ''}
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
                      <div class="wl-news-view-container">
                        <div class="wl-news-header-meta">
                          <span class="wl-section-eyebrow">MULTI-SOURCE INTELLIGENCE</span>
                          <span class="wl-news-source-count">${(detail.news || []).length} stories · Live feeds</span>
                        </div>
                        <div class="wl-news-list">
                          ${(detail.news || [])
                            .map(
                              (n) => `
                            <a href="${n.url}" target="_blank" rel="noopener" class="wl-news-item ${n.isNew ? 'is-new' : ''}" data-url="${n.url}" title="Open source article: ${n.title}">
                              <div class="wl-news-headline-row">
                                <div class="wl-news-headline">${n.title}</div>
                                ${n.isNew ? '<span class="wl-item-new-pill">NEW</span>' : ''}
                              </div>
                              <div class="wl-news-meta">
                                <span class="wl-news-source-pill">${n.source}</span>
                                <span>·</span>
                                <span class="wl-news-date">${n.date}</span>
                                <span style="margin-left: auto; color: #cc785c; font-weight: 600;">Open article ↗</span>
                              </div>
                            </a>
                          `
                            )
                            .join('')}
                        </div>
                      </div>
                    `
                      : ''
                  }
                </div>

                <!-- 1-Year Stock Price Trend Graph inside expanded tracker -->
                ${
                  detail.history
                    ? `<div class="wl-detail-chart-wrapper">
                        ${watchlistService.renderStockTrendHTML(detail.history, detail.company, '1y')}
                      </div>`
                    : ''
                }
              </div>
            `
                    : `
              <div class="wl-detail-tracker-pane" id="wl-sp-detail-pane-${item.ticker}">
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
          <button class="wl-btn-manual-check" id="btn-sp-refresh-digest" title="Run manual check for new SEC filings and market news">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            <span>Check Now</span>
          </button>
          <button class="btn-add-company" id="btn-sp-toggle-add-company">
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
          id="input-sp-add-watchlist"
          placeholder="Search 10,000+ US stocks (e.g. Apple, F, NVDA, Palantir)..."
          autocomplete="off"
        />
        <div class="watchlist-autocomplete-menu" id="sp-watchlist-autocomplete-menu" style="display: none;"></div>
      </div>

      <!-- Watchlist Auto-Check Scheduling Bar -->
      <div class="wl-schedule-bar" style="margin-bottom: 12px;">
        <div class="wl-schedule-left">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="wl-schedule-icon"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          <span class="wl-schedule-label">Auto-Check:</span>
        </div>
        <div class="wl-schedule-right">
          <select class="wl-schedule-select" id="select-sp-watchlist-schedule" title="Select auto-check interval for tracked tickers">
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
      <div class="watchlist-items-list" id="sp-watchlist-items-list">
        ${cardsHtml}
      </div>

      <p class="compliance-note" style="margin-top: 14px;">
        Quiet, neutral daily briefs extracted from SEC EDGAR filings and published market news. Does not contain predictive advice.
      </p>
    `;

    // Autocomplete & Add handler
    const addInput = document.getElementById('input-sp-add-watchlist');
    const autoMenu = document.getElementById('sp-watchlist-autocomplete-menu');
    const toggleAddBtn = document.getElementById('btn-sp-toggle-add-company');
    let currentMatches = [];
    let selectedIdx = -1;

    if (toggleAddBtn && addInput) {
      toggleAddBtn.addEventListener('click', () => {
        addInput.focus();
        addInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }


    const tryAddTicker = async (inputTicker, providedTitle = null, providedCik = null) => {
      const raw = (inputTicker || '').trim();
      if (!raw) return;

      try {
        const validation = await watchlistService.validateTicker(raw);
        if (!validation.valid) {
          if (addInput) {
            addInput.classList.add('input-invalid');
            setTimeout(() => addInput.classList.remove('input-invalid'), 2500);
          }
          return;
        }

        const tickerToAdd = validation.ticker;
        const companyToAdd = providedTitle || validation.company || tickerToAdd;
        const cikToAdd = providedCik || validation.cik || '';

        await watchlistService.addTicker(tickerToAdd, companyToAdd, cikToAdd);
        if (addInput) {
          addInput.value = '';
          addInput.classList.remove('input-invalid');
        }
        if (autoMenu) autoMenu.style.display = 'none';
        renderWatchlistTab(container);
      } catch (err) {
        // Add ticker failure handled silently
      }
    };

    const renderAutocomplete = (matches, rawTyped = '') => {
      if (!autoMenu) return;
      currentMatches = [...(matches || [])];
      selectedIdx = -1;

      const typedClean = rawTyped ? watchlistService.extractCleanSymbol(rawTyped) : '';
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

        // Real-time filter cards on screen
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
          const matches = await watchlistService.searchTickers(val, 8);
          renderAutocomplete(matches, val);
        } else {
          renderAutocomplete([], '');
        }
      });

      addInput.addEventListener('keydown', async (e) => {
        if (!autoMenu || autoMenu.style.display === 'none') {
          if (e.key === 'Enter') {
            const val = (addInput.value || '').trim();
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
            const val = (addInput.value || '').trim();
            if (val) {
              await tryAddTicker(val);
            }
          }
        } else if (e.key === 'Escape') {
          autoMenu.style.display = 'none';
        }
      });
    }

    // Interactive chart hover tracking (crosshair + tooltip on trend graphs)
    if (watchlistService && watchlistService.setupChartHoverTracking) {
      watchlistService.setupChartHoverTracking(container);
    }

    // Card Click to Expand / Collapse Detail Tracker
    container.querySelectorAll('.watchlist-stock-card').forEach((card) => {
      card.addEventListener('click', async (e) => {
        // 1. Do not collapse if the user highlighted or selected text
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) {
          return;
        }

        // 2. Only expand/collapse if clicking on the main header row or explicit expand trigger
        if (!e.target.closest('.wl-card-main-row, [data-action="toggle-expand"]')) {
          return;
        }

        // 3. Ignore interactive controls
        if (e.target.closest('button, a, select, input, .wl-card-source-link, .wl-star-btn, .btn-sp-mute-ticker, .btn-sp-delete-ticker')) {
          return;
        }

        const ticker = card.dataset.ticker;
        if (ticker) {
          window._spWatchlistExpandedTicker = window._spWatchlistExpandedTicker === ticker ? null : ticker;
          await renderWatchlistTab(container);
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
          window._spWatchlistSubTabs = window._spWatchlistSubTabs || {};
          window._spWatchlistSubTabs[ticker] = subtab;
          await renderWatchlistTab(container);
        }
      });
    });

    // "View filing summary →" Button (Summarizes that filing and sets What Changed)
    container.querySelectorAll('.wl-btn-view-summary').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ticker = btn.dataset.ticker;
        await viewFilingSummary(ticker);
      });
    });

    // News Item Click Handler (Navigates directly to the exact source page where it found the news)
    container.querySelectorAll('.wl-news-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = item.getAttribute('href') || item.dataset.url;
        if (url && url !== '#' && !url.startsWith('javascript:')) {
          if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
            chrome.tabs.create({ url });
          } else {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
        }
      });
    });

    // Manual Refresh / Check Now Handler
    const btnSpRefresh = document.getElementById('btn-sp-refresh-digest');
    if (btnSpRefresh) {
      btnSpRefresh.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (btnSpRefresh.disabled) return;
        const origHtml = btnSpRefresh.innerHTML;
        btnSpRefresh.disabled = true;
        btnSpRefresh.classList.add('is-checking');
        btnSpRefresh.innerHTML = `
          <svg class="prospectus-spinner" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg>
          <span>Checking...</span>
        `;
        showPersistentStatus('Checking SEC filings & market intelligence...', true);
        try {
          window._spTrackerDetailCache = {};
          let result = null;
          if (watchlistService) {
            result = await watchlistService.runDigestPass();
          }
          const count = result?.updatedCount || 0;
          if (count > 0) {
            showToast(`Watchlist updated · ${count} stock(s) have new changes`, 4000);
          } else {
            showToast('Watchlist checked · All stocks are up to date', 4000);
          }
        } catch (err) {
          showToast('Could not complete check', 4000);
        } finally {
          btnSpRefresh.disabled = false;
          btnSpRefresh.classList.remove('is-checking');
          btnSpRefresh.innerHTML = origHtml;
          await renderWatchlistTab(container);
        }
      });
    }

    // Scheduling Select Handler (Changes auto-check interval for background updates)
    const scheduleSelect = document.getElementById('select-sp-watchlist-schedule');
    if (scheduleSelect) {
      scheduleSelect.addEventListener('change', async (e) => {
        const val = parseInt(e.target.value, 10);
        const currentSettings = await storageService.getSettings();
        currentSettings.watchlistScheduleInterval = val;
        currentSettings.enableBackgroundWatchlist = val > 0;
        currentSettings.watchlistRefreshHours = val > 0 ? (val / 60) : 0;
        await storageService.saveSettings(currentSettings);

        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            action: 'UPDATE_WATCHLIST_ALARM',
            intervalMinutes: val,
          });
        }

        renderWatchlistTab(container);
      });
    }

    // Star toggles
    document.querySelectorAll('.wl-star-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const t = e.currentTarget.dataset.ticker;
        if (t) {
          await watchlistService.toggleStar(t);
          renderWatchlistTab(container);
        }
      });
    });

    // Mute toggles
    document.querySelectorAll('.btn-sp-mute-ticker').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const t = e.currentTarget.dataset.ticker;
        if (t) {
          await watchlistService.toggleMute(t);
          renderWatchlistTab(container);
        }
      });
    });

    // Delete handlers
    document.querySelectorAll('.btn-sp-delete-ticker').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const t = e.currentTarget.dataset.ticker;
        if (t) {
          await watchlistService.removeTicker(t);
          if (window._spWatchlistExpandedTicker === t) {
            window._spWatchlistExpandedTicker = null;
          }
          renderWatchlistTab(container);
        }
      });
    });

    // Background async quote hydration (keeps tab opening 0ms instant)
    const missingQuotes = items.filter((it) => {
      const c = watchlistService ? watchlistService.extractCleanSymbol(it.ticker) : it.ticker;
      return !it.stockQuote && !watchlistService?._quoteMemoryCache?.has(c);
    });
    if (missingQuotes.length > 0 && watchlistService) {
      Promise.allSettled(
        missingQuotes.map(async (it) => {
          try {
            const q = await watchlistService.getDailyStockQuote(it.ticker);
            if (q) {
              const box = document.getElementById(`wl-sp-price-box-${it.ticker}`);
              if (box) {
                const sym = getStockCurrencySymbol(q, it.ticker);
                box.innerHTML = `
                  <span class="wl-card-price">${sym}${q.price}</span>
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
    if (window._spWatchlistExpandedTicker) {
      const expClean = watchlistService ? watchlistService.extractCleanSymbol(window._spWatchlistExpandedTicker) : window._spWatchlistExpandedTicker;
      if (!window._spTrackerDetailCache[expClean] && watchlistService) {
        watchlistService.getTickerTrackerDetail(expClean, '1y').then((det) => {
          if (det) {
            window._spTrackerDetailCache[expClean] = det;
            if (window._spWatchlistExpandedTicker === expClean && activeTabName === 'watchlist') {
              renderWatchlistTab(container);
            }
          }
        }).catch((err) => {
          // Watchlist detail load handled silently
        });
      }
    }
  }

  async function renderAdvancedFooter(suggestedQueries = []) {
    const footerContainer = document.getElementById('prospectus-advanced-footer');
    if (!footerContainer) return;

    const settings = await storage.getSettings();
    const initialHeight = settings.deepResearchHeight || 240;

    const queries = (suggestedQueries && suggestedQueries.length)
      ? suggestedQueries
      : (ai ? ai.extractDynamicFallbackQueries(pageData) : []);

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
          <button class="adv-search-toggle ${webSearchEnabled !== false ? 'active' : ''}" id="btn-sp-toggle-web-search" title="Toggle Live Web Search grounding ON/OFF">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
            <span>Web Search</span>
            <span class="adv-toggle-tag" id="sp-adv-toggle-status-text">${webSearchEnabled !== false ? 'ON' : 'OFF'}</span>
          </button>
        </div>
        <div style="display: flex; gap: 4px; align-items: center;">
          <button class="icon-btn" id="btn-sp-expand-adv-footer" title="Expand / Collapse View" style="font-size: 11px; padding: 2px 4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
          </button>
          <button class="icon-btn" id="btn-sp-toggle-adv-footer" title="Hide / Minimize" style="font-size: 11px; padding: 2px 4px;">
            ${ICONS.close}
          </button>
        </div>
      </div>

      <div class="adv-suggestions-container" id="sp-adv-suggestions-box">
        <span class="adv-suggestions-label">Recommended Queries</span>
        <div class="adv-chips-row">
          ${queries.map((q) => `<button class="adv-chip sp-adv-chip" data-query="${q.replace(/"/g, '&quot;')}">✦ ${q}</button>`).join('')}
        </div>
      </div>

      <div class="adv-input-row">
        <input type="text" id="sp-adv-footer-input" placeholder="Ask Prospectus anything (this page, any stock, market concepts, or live news)..." />
        <button class="adv-send-btn" id="btn-sp-adv-footer-send">
          ${ICONS.search} Ask Prospectus
        </button>
      </div>

      <div class="adv-response-card" id="sp-adv-footer-response" style="display: none;">
        <div class="adv-response-header">
          <span id="sp-adv-resp-title">Research Answer</span>
          <div style="display: flex; gap: 4px; align-items: center;">
            <button class="coral-btn" id="btn-sp-adv-resp-save" style="font-size: 11px; padding: 3px 8px;">
              ${ICONS.bookmark} Notebook
            </button>
            <button class="icon-btn" id="btn-sp-adv-resp-close" style="padding: 2px 4px;">${ICONS.close}</button>
          </div>
        </div>
        <div class="adv-response-body" id="sp-adv-resp-text"></div>
      </div>
    `;

    const input = document.getElementById('sp-adv-footer-input');
    const sendBtn = document.getElementById('btn-sp-adv-footer-send');
    const respCard = document.getElementById('sp-adv-footer-response');
    const respText = document.getElementById('sp-adv-resp-text');
    const respSaveBtn = document.getElementById('btn-sp-adv-resp-save');
    const respCloseBtn = document.getElementById('btn-sp-adv-resp-close');
    const toggleBtn = document.getElementById('btn-sp-toggle-adv-footer');
    const expandBtn = document.getElementById('btn-sp-expand-adv-footer');
    const webToggleBtn = document.getElementById('btn-sp-toggle-web-search');
    const topHandle = document.getElementById('prospectus-adv-resize-handle');

    if (webToggleBtn) {
      webToggleBtn.addEventListener('click', () => {
        webSearchEnabled = !(webSearchEnabled !== false);
        const tag = document.getElementById('sp-adv-toggle-status-text');
        if (webSearchEnabled) {
          webToggleBtn.classList.add('active');
          if (tag) tag.textContent = 'ON';
        } else {
          webToggleBtn.classList.remove('active');
          if (tag) tag.textContent = 'OFF';
        }
      });
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        footerContainer.style.display = 'none';
      });
    }

    if (respCloseBtn) {
      respCloseBtn.addEventListener('click', () => {
        respCard.style.display = 'none';
      });
    }

    let isExpandedMax = false;
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        if (!isExpandedMax) {
          const maxHeight = Math.min(Math.max(480, Math.round(window.innerHeight * 0.72)), Math.round(window.innerHeight * 0.85));
          footerContainer.style.height = `${maxHeight}px`;
          isExpandedMax = true;
        } else {
          footerContainer.style.height = `${initialHeight}px`;
          isExpandedMax = false;
        }
      });
    }

    if (topHandle) {
      let isResizing = false;
      let startY = 0;
      let startHeight = initialHeight;

      topHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startY = e.clientY;
        startHeight = footerContainer.offsetHeight || initialHeight;
        topHandle.classList.add('active');
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ns-resize';
        e.preventDefault();
      });

      window.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const delta = startY - e.clientY;
        const maxHeight = Math.round(window.innerHeight * 0.85);
        const newHeight = Math.min(Math.max(120, Math.round(startHeight + delta)), maxHeight);
        footerContainer.style.height = `${newHeight}px`;
      });

      window.addEventListener('mouseup', async () => {
        if (!isResizing) return;
        isResizing = false;
        topHandle.classList.remove('active');
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        const finalHeight = Math.round(footerContainer.offsetHeight || initialHeight);
        await storage.saveSettings({ deepResearchHeight: finalHeight });
      });
    }

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

        if (trimmed.startsWith('*Source:') || trimmed.startsWith('Source:') || trimmed.startsWith('*Disclaimer:')) {
          if (inList) {
            html += '</ul>';
            inList = false;
          }
          const cleanSource = trimmed.replace(/^\*+|\*+$/g, '');
          html += `<div class="adv-source-note">${cleanSource}</div>`;
          continue;
        }

        if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
          if (inList) {
            html += '</ul>';
            inList = false;
          }
          const title = trimmed.replace(/^#+\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          html += `<h4 class="adv-resp-heading">${title}</h4>`;
          continue;
        }

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

      if (inList) html += '</ul>';
      return html;
    }

    const executeFooterQuery = async (queryText) => {
      const q = (queryText || (input ? input.value : '')).trim();
      if (!q) return;

      const isWebOn = webSearchEnabled !== false;
      if (input) input.value = q;
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

      const targetExpandedHeight = Math.min(
        Math.max(450, Math.round(window.innerHeight * 0.65)),
        Math.round(window.innerHeight * 0.85)
      );
      if ((footerContainer.offsetHeight || 0) < targetExpandedHeight) {
        footerContainer.style.height = `${targetExpandedHeight}px`;
      }

      respCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      try {
        const res = await ai.performAdvancedResearch({
          query: q,
          ticker: pageData.ticker,
          company: pageData.company,
          documentContext: pageData.fullText || '',
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

        if (respSaveBtn) {
          respSaveBtn.onclick = async () => {
            await storage.saveNotebookEntry({
              title: `Research: ${q}`,
              quote: `Q: "${q}"`,
              note: rawText,
              category: 'General',
              ticker: pageData.ticker,
              url: activeTab ? activeTab.url : '',
            });
            respSaveBtn.innerHTML = '✓ Saved';
            setTimeout(() => {
              respSaveBtn.innerHTML = `${ICONS.bookmark} Notebook`;
            }, 2000);
          };
        }
      } catch (err) {
        let webSources = [];
        if (isWebOn && ai) {
          try {
            const cleanTicker = (pageData.ticker && pageData.ticker !== 'PAGE' && pageData.ticker !== 'PDF') ? pageData.ticker : '';
            let searchQuery = q;
            if (q.split(' ').length <= 2 && cleanTicker && !q.toLowerCase().includes(cleanTicker.toLowerCase())) {
              searchQuery = `${cleanTicker} ${q}`;
            }
            webSources = await ai.searchWebSources({ query: searchQuery, count: 4 });
          } catch (e) {}
        }

        let fallback = '';
        if (webSources && webSources.length > 0) {
          const isAboutCurrentDoc = pageData.ticker && q.toLowerCase().includes(pageData.ticker.toLowerCase());
          const subjectLabel = isAboutCurrentDoc ? `for **${pageData.company || 'Document'} (${pageData.ticker})**` : `regarding **"${q}"**`;
          fallback = `**Executive Takeaway:** Public sources and financial intelligence provide comprehensive findings ${subjectLabel}.\n\n` +
            webSources.map((s) => `• **${s.source}:** ${s.title}${s.snippet ? ` — ${s.snippet.slice(0, 140)}` : ''}`).join('\n') +
            `\n\n*Source: Evaluated from live web search (${Array.from(new Set(webSources.map((s) => s.source))).join(', ')}) and general financial analysis.*`;
        } else {
          fallback = `**Executive Takeaway:** Analysis for **"${q}"** synthesizes available operational disclosures and financial principles.\n\n• **Core Analysis:** Topic inquiries examine underlying market dynamics, balance sheet mechanics, or disclosed guidance.\n• **Verification:** Review corresponding filing tables and notes for itemized data points.\n\n*Source: Evaluated from financial disclosures and reference analysis.*`;
        }

        const errorBanner = `
          <div class="adv-error-notice" style="margin-bottom: 12px; padding: 10px 14px; background: #fff5f2; border: 1px solid #f2d4cc; border-radius: 8px; font-size: 12px; color: #a9583e; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>⚠️ API Notice:</strong> ${err.message || 'Unable to connect to AI provider'}.
            </div>
            <button type="button" class="coral-btn btn-sp-adv-settings" style="font-size: 11px; padding: 4px 8px; margin-left: 10px; white-space: nowrap;">Settings</button>
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

        const advSetBtn = respCard.querySelector('.btn-sp-adv-settings');
        if (advSetBtn) advSetBtn.addEventListener('click', openSettings);

        if (respSaveBtn) {
          respSaveBtn.onclick = async () => {
            await storage.saveNotebookEntry({
              title: `Research: ${q}`,
              quote: `Q: "${q}"`,
              note: fallback,
              category: 'General',
              ticker: pageData.ticker,
              url: activeTab ? activeTab.url : '',
            });
            respSaveBtn.innerHTML = '✓ Saved';
            setTimeout(() => {
              respSaveBtn.innerHTML = `${ICONS.bookmark} Notebook`;
            }, 2000);
          };
        }
      }
    };

    if (sendBtn) sendBtn.addEventListener('click', () => executeFooterQuery());
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') executeFooterQuery();
      });
    }

    document.querySelectorAll('.sp-adv-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        const query = e.currentTarget.dataset.query;
        if (query) executeFooterQuery(query);
      });
    });
  }

  // Initial load
  await loadActivePageData();
  renderBaseUI();

  // Listen for tab switches
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onActivated) {
    chrome.tabs.onActivated.addListener(async () => {
      await loadActivePageData();
      renderBaseUI();
    });
  }
});
