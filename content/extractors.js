/**
 * Prospectus - Financial & Report Web Extractors
 * Precision detection and high-signal text parsing for SEC EDGAR filings,
 * earnings reports, financial portals, and general research documents.
 */

// Common CIK to Ticker / Name mapping for top searched SEC companies
const KNOWN_CIKS = {
  '0001318605': { ticker: 'TSLA', company: 'Tesla, Inc.', exchange: 'NASDAQ', sector: 'Automotive / Tech' },
  '1318605': { ticker: 'TSLA', company: 'Tesla, Inc.', exchange: 'NASDAQ', sector: 'Automotive / Tech' },
  '0000320193': { ticker: 'AAPL', company: 'Apple Inc.', exchange: 'NASDAQ', sector: 'Technology' },
  '320193': { ticker: 'AAPL', company: 'Apple Inc.', exchange: 'NASDAQ', sector: 'Technology' },
  '0000789019': { ticker: 'MSFT', company: 'Microsoft Corporation', exchange: 'NASDAQ', sector: 'Technology' },
  '789019': { ticker: 'MSFT', company: 'Microsoft Corporation', exchange: 'NASDAQ', sector: 'Technology' },
  '0001018724': { ticker: 'AMZN', company: 'Amazon.com, Inc.', exchange: 'NASDAQ', sector: 'Consumer Discretionary' },
  '1018724': { ticker: 'AMZN', company: 'Amazon.com, Inc.', exchange: 'NASDAQ', sector: 'Consumer Discretionary' },
  '0001652044': { ticker: 'GOOGL', company: 'Alphabet Inc.', exchange: 'NASDAQ', sector: 'Technology' },
  '1652044': { ticker: 'GOOGL', company: 'Alphabet Inc.', exchange: 'NASDAQ', sector: 'Technology' },
  '0001045810': { ticker: 'NVDA', company: 'NVIDIA Corporation', exchange: 'NASDAQ', sector: 'Semiconductors' },
  '1045810': { ticker: 'NVDA', company: 'NVIDIA Corporation', exchange: 'NASDAQ', sector: 'Semiconductors' },
  '0001326801': { ticker: 'META', company: 'Meta Platforms, Inc.', exchange: 'NASDAQ', sector: 'Technology' },
  '1326801': { ticker: 'META', company: 'Meta Platforms, Inc.', exchange: 'NASDAQ', sector: 'Technology' },
};

class FinancialExtractors {
  /**
   * Main entry point to detect if the current page is a financial report, filing, or company profile
   */
  static extractPageData() {
    const url = window.location.href.toLowerCase();
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    const bodyText = document.body ? document.body.innerText : '';

    // 1. SEC EDGAR (Filing documents, company browse, search results with CIK)
    if (hostname.includes('sec.gov')) {
      if (
        pathname.endsWith('.xml') ||
        pathname.endsWith('.xsd') ||
        pathname.endsWith('.json')
      ) {
        return this.extractUniversal();
      }

      const isSecPage =
        url.includes('/browse/') ||
        url.includes('/ix?doc=') ||
        url.includes('/archives/edgar/data/') ||
        url.includes('/edgar/data/') ||
        url.includes('cik=') ||
        url.includes('type=10-k') ||
        url.includes('type=10-q') ||
        url.includes('type=8-k') ||
        bodyText.includes('FORM 10-K') ||
        bodyText.includes('FORM 10-Q') ||
        bodyText.includes('FORM 8-K') ||
        bodyText.includes('Item 1A') ||
        bodyText.includes('UNITED STATES SECURITIES AND EXCHANGE COMMISSION');

      if (isSecPage) {
        return this.extractSecEdgar();
      }
    }

    // 2. Standalone Demo / Test Page with Filing Markup
    if (
      url.includes('demo.html') ||
      (bodyText.includes('FORM 10-K') && bodyText.includes('Risk Factors'))
    ) {
      return this.extractSecEdgar();
    }

    // 3. Yahoo Finance (Quote, News, Financials, or Analysis tabs)
    if (hostname.includes('finance.yahoo.com')) {
      const isYahooReport =
        pathname.includes('/quote/') ||
        pathname.includes('/news/') ||
        pathname.includes('/m/');
      if (isYahooReport) {
        return this.extractYahooFinance();
      }
    }

    // 4. Seeking Alpha (Articles, Transcripts, Symbol pages)
    if (hostname.includes('seekingalpha.com')) {
      const isSAReport =
        pathname.includes('/article/') ||
        pathname.includes('/symbol/') ||
        pathname.includes('/earnings/');
      if (isSAReport) {
        return this.extractSeekingAlpha();
      }
    }

    // 5. TradingView (Symbol or Chart pages)
    if (hostname.includes('tradingview.com')) {
      if (pathname.includes('/symbols/') || pathname.includes('/chart/')) {
        return this.extractTradingView();
      }
    }

    // 6. MarketWatch (Stock quote or Story articles)
    if (hostname.includes('marketwatch.com')) {
      if (pathname.includes('/investing/stock/') || pathname.includes('/story/') || pathname.includes('/articles/')) {
        return this.extractMarketWatch();
      }
    }

    // 7. Finviz (Quote pages)
    if (hostname.includes('finviz.com')) {
      if (url.includes('quote.ashx?t=')) {
        return this.extractFinviz();
      }
    }

    // Non-report or generic webpage fallback
    return this.extractUniversal();
  }

  /**
   * 1. SEC EDGAR Parser (Browse pages + Filing Documents)
   */
  static extractSecEdgar() {
    const title = document.title;
    const bodyText = document.body ? document.body.innerText : '';
    const url = window.location.href;

    let ticker = 'NWMC';
    let company = 'Northwind Materials Co.';
    let formType = '10-K';
    let filingDate = 'Aug 1, 2026';
    let exchange = 'NYSE';
    let sector = 'Industrials';

    // Parse URL params
    const urlParams = new URLSearchParams(window.location.search);
    const cikParam = urlParams.get('CIK') || urlParams.get('cik');
    const typeParam = urlParams.get('type') || urlParams.get('type');

    if (cikParam) {
      const cleanCik = cikParam.trim();
      ticker = `CIK ${cleanCik}`;
      company = `SEC Entity ${cleanCik}`;
      
      if (KNOWN_CIKS[cleanCik]) {
        ticker = KNOWN_CIKS[cleanCik].ticker;
        company = KNOWN_CIKS[cleanCik].company;
        exchange = KNOWN_CIKS[cleanCik].exchange;
        sector = KNOWN_CIKS[cleanCik].sector;
      }
    }

    if (typeParam) formType = typeParam.toUpperCase();

    // Look for company title in SEC DOM
    const companyHeader = document.querySelector(
      '.companyName, #company-name, #entity-name, .entity-name, .formGrouping, h1, .sec-header, div[data-testid="entity-name"]'
    );
    if (companyHeader && companyHeader.innerText) {
      const text = companyHeader.innerText.trim();
      const match = text.match(/([A-Z0-9.\s,]+?)(?:\s*\((?:CIK|Ticker)[\s:]*([A-Z0-9]+)\)|$)/i);
      if (match) {
        if (match[1] && match[1].length > 2 && !match[1].includes('Search')) {
          company = match[1].replace(/FORM\s+10-[KQ]/i, '').replace(/Company Search/i, '').trim();
        }
        if (match[2]) ticker = match[2].trim().toUpperCase();
      }
    }

    // Check title tag for company name
    if (title && title.includes('EDGAR') && title.includes('-')) {
      const parts = title.split('-');
      if (parts[0] && parts[0].trim().length > 2) {
        company = parts[0].replace(/EDGAR\s+Search\s+Results/i, '').trim();
      }
    }

    // Form type detection
    if (bodyText.includes('FORM 10-K') || title.includes('10-K')) formType = '10-K';
    else if (bodyText.includes('FORM 10-Q') || title.includes('10-Q')) formType = '10-Q';
    else if (bodyText.includes('FORM 8-K') || title.includes('8-K')) formType = '8-K';
    else if (url.includes('browse')) formType = 'SEC Filings';

    // Extract Risk Factors (Item 1A)
    let riskFactorsText = '';
    const riskMatch = bodyText.match(/Item\s+1A[\.\s–-]+Risk\s+Factors([\s\S]{300,30000}?)(?:Item\s+(?:1B|2|3|4|7)\b|$)/i);
    if (riskMatch && riskMatch[1]) {
      riskFactorsText = this.cleanSectionText(riskMatch[1]);
    }

    // Extract MD&A (Item 7 / Item 2 in 10-Q)
    let mdaText = '';
    const mdaMatch = bodyText.match(/Item\s+(?:7|2)[\.\s–-]+Management(?:'s)?\s+Discussion([\s\S]{300,30000}?)(?:Item\s+(?:7A|8|3)\b|$)/i);
    if (mdaMatch && mdaMatch[1]) {
      mdaText = this.cleanSectionText(mdaMatch[1]);
    }

    // Extract Business Overview (Item 1)
    let businessText = '';
    const bizMatch = bodyText.match(/Item\s+1[\.\s–-]+Business([\s\S]{300,20000}?)(?:Item\s+1A\b|$)/i);
    if (bizMatch && bizMatch[1]) {
      businessText = this.cleanSectionText(bizMatch[1]);
    }

    // Extract list of filings if on browse page
    const filingsList = [];
    document.querySelectorAll('table.tableFile2 tr, table[summary="Results"] tr, #filingsTable tbody tr').forEach((row) => {
      const text = row.innerText.trim();
      if (text && (text.includes('10-K') || text.includes('10-Q') || text.includes('8-K'))) {
        filingsList.push(text.replace(/\s+/g, ' ').slice(0, 100));
      }
    });

    const highSignalText = [
      businessText ? `--- ITEM 1: BUSINESS OVERVIEW ---\n${businessText}` : '',
      riskFactorsText ? `--- ITEM 1A: RISK FACTORS ---\n${riskFactorsText}` : '',
      mdaText ? `--- ITEM 7: MD&A / RESULTS ---\n${mdaText}` : '',
      filingsList.length ? `--- RECENT SEC FILINGS ---\n${filingsList.slice(0, 10).join('\n')}` : '',
    ].filter(Boolean).join('\n\n') || this.cleanSectionText(bodyText.slice(0, 20000));

    return {
      isFinanceSite: true,
      isReportPage: true,
      siteType: 'sec_edgar',
      ticker,
      company,
      exchange,
      sector,
      formType,
      filingDate,
      periodBadge: `${formType} · ${filingDate}`,
      riskFactorsText,
      mdaText,
      headlines: [
        `${company} (${ticker}) SEC filings and regulatory disclosures`,
        `Item 1A Risk Factors, MD&A, and capital allocation reports`,
      ],
      fullText: highSignalText,
    };
  }

  /**
   * 2. Yahoo Finance Parser
   */
  static extractYahooFinance() {
    const path = window.location.pathname;
    let ticker = 'AAPL';
    let company = 'Apple Inc.';
    let exchange = 'NASDAQ';
    let sector = 'Technology';

    const tickerMatch = path.match(/\/quote\/([A-Za-z0-9.-]+)/i);
    if (tickerMatch) ticker = tickerMatch[1].toUpperCase();

    const header = document.querySelector('h1.yf-xx, h1[data-testid="quote-hdr"], header h1');
    if (header && header.innerText) {
      const parts = header.innerText.split('(');
      company = parts[0].trim();
      if (parts[1]) ticker = parts[1].replace(')', '').trim().toUpperCase();
    }

    const headlines = [];
    document.querySelectorAll('section[data-testid="storyitem"] h3, ul.stream-items li h3, #news h3, div[data-testid="news-item"] h3').forEach((node) => {
      const text = node.innerText.trim();
      if (text && !headlines.includes(text)) headlines.push(text);
    });

    const descEl = document.querySelector('section[data-testid="description"], .quote-sub-section');
    const descText = descEl ? descEl.innerText.trim() : '';
    const cleanBody = this.cleanSectionText(document.body ? document.body.innerText : '');

    return {
      isFinanceSite: true,
      isReportPage: true,
      siteType: 'yahoo_finance',
      ticker,
      company,
      exchange,
      sector,
      formType: 'Equity Research',
      filingDate: 'Live Feed',
      periodBadge: `${exchange} · Live Data`,
      headlines: headlines.slice(0, 10),
      fullText: `Company: ${company} (${ticker})\nSector: ${sector}\n\nRecent News Coverage:\n${headlines.join('\n')}\n\nOverview:\n${descText || cleanBody.slice(0, 15000)}`,
    };
  }

  /**
   * 3. Seeking Alpha Parser
   */
  static extractSeekingAlpha() {
    let ticker = 'EQUITY';
    let company = document.title;

    const path = window.location.pathname;
    const symbolMatch = path.match(/\/(?:symbol|article)\/([A-Za-z0-9.-]+)/i);
    if (symbolMatch) ticker = symbolMatch[1].toUpperCase();

    const titleEl = document.querySelector('h1[data-test-id="post-title"], h1');
    if (titleEl) company = titleEl.innerText.trim();

    const headlines = [];
    document.querySelectorAll('article h3, [data-test-id="post-list-item"] a, .sa-art h3').forEach((el) => {
      if (el.innerText.trim()) headlines.push(el.innerText.trim());
    });

    const articleBody = document.querySelector('div[data-test-id="article-content"], article');
    const cleanContent = articleBody ? this.cleanSectionText(articleBody.innerText) : this.cleanSectionText(document.body.innerText.slice(0, 20000));

    return {
      isFinanceSite: true,
      isReportPage: true,
      siteType: 'seeking_alpha',
      ticker,
      company,
      exchange: 'US',
      sector: 'Market Analysis',
      formType: 'Analysis & Transcript',
      filingDate: 'Current',
      periodBadge: `Article · ${new Date().toLocaleDateString()}`,
      headlines: headlines.slice(0, 8),
      fullText: `Title: ${company}\nTicker: ${ticker}\n\nContent:\n${cleanContent}`,
    };
  }

  /**
   * 4. TradingView Parser
   */
  static extractTradingView() {
    let ticker = 'SYMBOL';
    const path = window.location.pathname;
    const match = path.match(/\/symbols\/([A-Za-z0-9.-]+)/i);
    if (match) ticker = match[1].toUpperCase();

    return {
      isFinanceSite: true,
      isReportPage: true,
      siteType: 'tradingview',
      ticker,
      company: ticker,
      exchange: 'Market',
      sector: 'Equities',
      formType: 'Technical & News Feed',
      filingDate: 'Realtime',
      periodBadge: `${ticker} · Realtime`,
      headlines: ['TradingView market overview and news stream'],
      fullText: this.cleanSectionText(document.body ? document.body.innerText.slice(0, 15000) : ''),
    };
  }

  /**
   * 5. MarketWatch Parser
   */
  static extractMarketWatch() {
    let ticker = 'MW';
    const path = window.location.pathname;
    const match = path.match(/\/investing\/stock\/([A-Za-z0-9.-]+)/i);
    if (match) ticker = match[1].toUpperCase();

    const nameEl = document.querySelector('h1.company__name');
    const company = nameEl ? nameEl.innerText.trim() : ticker;

    const headlines = [];
    document.querySelectorAll('.article__headline, .latest-news h4').forEach((el) => {
      if (el.innerText.trim()) headlines.push(el.innerText.trim());
    });

    return {
      isFinanceSite: true,
      isReportPage: true,
      siteType: 'marketwatch',
      ticker,
      company,
      exchange: 'US',
      sector: 'Financial Media',
      formType: 'Market Overview',
      filingDate: 'Live',
      periodBadge: `${ticker} · MarketWatch`,
      headlines: headlines.slice(0, 8),
      fullText: this.cleanSectionText(document.body ? document.body.innerText.slice(0, 20000) : ''),
    };
  }

  /**
   * 6. Finviz Parser
   */
  static extractFinviz() {
    const urlParams = new URLSearchParams(window.location.search);
    const ticker = (urlParams.get('t') || 'FINVIZ').toUpperCase();
    const headlines = [];

    document.querySelectorAll('#news-table a.tab-link-news').forEach((a) => {
      if (a.innerText.trim()) headlines.push(a.innerText.trim());
    });

    return {
      isFinanceSite: true,
      isReportPage: true,
      siteType: 'finviz',
      ticker,
      company: ticker,
      exchange: 'Finviz Profile',
      sector: 'Equities',
      formType: 'Financial Screener',
      filingDate: 'Current',
      periodBadge: `${ticker} · Finviz`,
      headlines: headlines.slice(0, 10),
      fullText: this.cleanSectionText(document.body ? document.body.innerText.slice(0, 20000) : ''),
    };
  }

  /**
   * 7. Universal Fallback for any general page
   */
  static extractUniversal() {
    const title = document.title || 'Web Document';
    const h1 = document.querySelector('h1');
    const pageHeading = h1 ? h1.innerText.trim() : title;

    // Clean body text by stripping DOM navigation noise
    const clone = document.body ? document.body.cloneNode(true) : null;
    if (clone) {
      const removeSelectors = [
        'script', 'style', 'nav', 'footer', 'header', 'noscript', 'iframe',
        '#prospectus-root', '.cookie-banner', '.advertisement', '.ad-slot',
        'aside', '.sidebar', '.social-share'
      ];
      removeSelectors.forEach((sel) => {
        clone.querySelectorAll(sel).forEach((el) => el.remove());
      });
    }

    const cleanText = clone ? this.cleanSectionText(clone.innerText) : '';

    return {
      isFinanceSite: false,
      isReportPage: false,
      siteType: 'generic_web',
      ticker: 'PAGE',
      company: pageHeading.slice(0, 45),
      exchange: 'Web',
      sector: 'Article / Document',
      formType: 'Web Document',
      filingDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      periodBadge: 'General Page',
      headlines: [pageHeading],
      fullText: `Document: ${pageHeading}\nSource: ${window.location.hostname}\n\nContent:\n${cleanText.slice(0, 15000)}`,
    };
  }

  /**
   * Helper to strip boilerplate headers, excessive whitespace, and repetitive table markers
   */
  static cleanSectionText(text) {
    if (!text) return '';
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/Table of Contents/gi, '')
      .replace(/UNITED STATES SECURITIES AND EXCHANGE COMMISSION[\s\S]{0,300}?Washington,\s*D\.C\.\s*20549/gi, '')
      .trim();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FinancialExtractors };
}
if (typeof window !== 'undefined') {
  window.FinancialExtractors = FinancialExtractors;
}
