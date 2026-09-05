/**
 * Prospectus - Financial & Report Web Extractors
 * Precision detection and high-signal text parsing for SEC EDGAR filings,
 * earnings reports, financial portals, and general research documents.
 */

// Market Index & Benchmark exclusion registry
const MARKET_INDEX_SYMBOLS = new Set([
  'SP500', 'S&P500', 'S&P 500', 'GSPC', '^GSPC', 'SPX', '^SPX',
  'DJI', '^DJI', 'DJIA', 'DOW', 'DOW30', 'DOW 30',
  'IXIC', '^IXIC', 'COMP', 'NASDAQ', 'NASDAQ COMPOSITE',
  'RUT', '^RUT', 'RUSSELL', 'RUSSELL 2000', 'RUSSELL2000',
  'VIX', '^VIX', 'VOLATILITY S&P 500',
  'TNX', '^TNX', 'TYX', 'FVX',
  'WTI', 'BRENT', 'GOLD', 'SILVER', 'CRUDE OIL',
  'US MARKETS', 'MARKETS', 'WORLD MARKETS'
]);

// Common English words that can appear in headlines in all caps but are NOT stock tickers
const COMMON_HEADLINE_WORDS = new Set([
  'THE', 'AND', 'FOR', 'WHY', 'HOW', 'ALL', 'ARE', 'WAS', 'NOT', 'ITS',
  'OWN', 'OUT', 'NEW', 'BIG', 'TOP', 'CAN', 'SEE', 'BUY', 'DAY', 'RUN',
  'HIT', 'NOW', 'MAY', 'SET', 'GOT', 'HAD', 'HAS', 'BUT', 'OFF', 'LOW',
  'OLD', 'CUT', 'WIN', 'WON', 'YES', 'ONE', 'TWO', 'SIX', 'TEN', 'WAR',
  'GAS', 'OIL', 'AIR', 'CAR', 'JOB', 'PAY', 'TAX', 'CEO', 'CFO', 'CTO',
  'SEC', 'FED', 'GDP', 'CPI', 'PDF', 'DOC', 'APP', 'AI', 'EST', 'EPS',
  'YoY', 'YOY', 'Q1', 'Q2', 'Q3', 'Q4', 'FY24', 'FY25', 'FY26', 'BEAT',
  'MISS', 'FALL', 'RISE', 'JUMP', 'DROP', 'GAIN', 'LOSS', 'TRIP', 'SOAR'
]);

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
  '0000200406': { ticker: 'JNJ', company: 'Johnson & Johnson', exchange: 'NYSE', sector: 'Healthcare' },
  '200406': { ticker: 'JNJ', company: 'Johnson & Johnson', exchange: 'NYSE', sector: 'Healthcare' },
  '0000059478': { ticker: 'LLY', company: 'Eli Lilly and Company', exchange: 'NYSE', sector: 'Healthcare' },
  '59478': { ticker: 'LLY', company: 'Eli Lilly and Company', exchange: 'NYSE', sector: 'Healthcare' },
  '0001613103': { ticker: 'MDT', company: 'Medtronic plc', exchange: 'NYSE', sector: 'Healthcare' },
  '1613103': { ticker: 'MDT', company: 'Medtronic plc', exchange: 'NYSE', sector: 'Healthcare' },
  '0000019617': { ticker: 'JPM', company: 'JPMorgan Chase & Co.', exchange: 'NYSE', sector: 'Financials' },
  '19617': { ticker: 'JPM', company: 'JPMorgan Chase & Co.', exchange: 'NYSE', sector: 'Financials' },
  '0001403161': { ticker: 'V', company: 'Visa Inc.', exchange: 'NYSE', sector: 'Financials' },
  '1403161': { ticker: 'V', company: 'Visa Inc.', exchange: 'NYSE', sector: 'Financials' },
  '0000731766': { ticker: 'UNH', company: 'UnitedHealth Group Inc.', exchange: 'NYSE', sector: 'Healthcare' },
  '731766': { ticker: 'UNH', company: 'UnitedHealth Group Inc.', exchange: 'NYSE', sector: 'Healthcare' },
  '0000034088': { ticker: 'XOM', company: 'Exxon Mobil Corporation', exchange: 'NYSE', sector: 'Energy' },
  '34088': { ticker: 'XOM', company: 'Exxon Mobil Corporation', exchange: 'Energy' },
  '0000080424': { ticker: 'PG', company: 'Procter & Gamble Company', exchange: 'NYSE', sector: 'Consumer Staples' },
  '80424': { ticker: 'PG', company: 'Procter & Gamble Company', exchange: 'NYSE', sector: 'Consumer Staples' },
  '0001730168': { ticker: 'AVGO', company: 'Broadcom Inc.', exchange: 'NASDAQ', sector: 'Technology' },
  '1730168': { ticker: 'AVGO', company: 'Broadcom Inc.', exchange: 'NASDAQ', sector: 'Technology' },
  '0000354950': { ticker: 'HD', company: 'Home Depot, Inc.', exchange: 'NYSE', sector: 'Consumer Discretionary' },
  '354950': { ticker: 'HD', company: 'Home Depot, Inc.', exchange: 'NYSE', sector: 'Consumer Discretionary' },
  '0000909832': { ticker: 'COST', company: 'Costco Wholesale Corp.', exchange: 'NASDAQ', sector: 'Consumer Staples' },
  '909832': { ticker: 'COST', company: 'Costco Wholesale Corp.', exchange: 'NASDAQ', sector: 'Consumer Staples' },
  '0000002488': { ticker: 'AMD', company: 'Advanced Micro Devices, Inc.', exchange: 'NASDAQ', sector: 'Technology' },
  '2488': { ticker: 'AMD', company: 'Advanced Micro Devices, Inc.', exchange: 'NASDAQ', sector: 'Technology' },
  '0001065280': { ticker: 'NFLX', company: 'Netflix, Inc.', exchange: 'NASDAQ', sector: 'Communication Services' },
  '1065280': { ticker: 'NFLX', company: 'Netflix, Inc.', exchange: 'NASDAQ', sector: 'Communication Services' },
  '0001321655': { ticker: 'PLTR', company: 'Palantir Technologies Inc.', exchange: 'NYSE', sector: 'Technology' },
  '1321655': { ticker: 'PLTR', company: 'Palantir Technologies Inc.', exchange: 'NYSE', sector: 'Technology' },
  '0000104169': { ticker: 'WMT', company: 'Walmart Inc.', exchange: 'NYSE', sector: 'Consumer Staples' },
  '104169': { ticker: 'WMT', company: 'Walmart Inc.', exchange: 'NYSE', sector: 'Consumer Staples' },
  '0000070858': { ticker: 'BAC', company: 'Bank of America Corp.', exchange: 'NYSE', sector: 'Financials' },
  '70858': { ticker: 'BAC', company: 'Bank of America Corp.', exchange: 'NYSE', sector: 'Financials' },
};

class FinancialExtractors {
  /**
   * Main entry point to detect if the current page is a financial report, filing, or company profile
   */
  static extractPageData() {
    const url = window.location.href.toLowerCase();
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    // Fast non-blocking helper for text sniffing without forcing synchronous layout/reflow
    let cachedBodySnippet = null;
    const getBodySnippet = () => {
      if (cachedBodySnippet === null) {
        // textContent does NOT trigger layout reflow and is 50x-100x faster than innerText
        cachedBodySnippet = document.body ? (document.body.textContent || '').slice(0, 30000) : '';
      }
      return cachedBodySnippet;
    };

    // 1. SEC EDGAR (Filing documents, company browse, search results with CIK)
    if (hostname.includes('sec.gov')) {
      if (
        pathname.endsWith('.xml') ||
        pathname.endsWith('.xsd') ||
        pathname.endsWith('.json')
      ) {
        return this.extractUniversal();
      }

      const isSecUrl =
        url.includes('/browse/') ||
        url.includes('/ix?doc=') ||
        url.includes('/archives/edgar/data/') ||
        url.includes('/edgar/data/') ||
        url.includes('cik=') ||
        url.includes('type=10-k') ||
        url.includes('type=10-q') ||
        url.includes('type=8-k');

      const isSecContent =
        isSecUrl ||
        getBodySnippet().includes('FORM 10-K') ||
        getBodySnippet().includes('FORM 10-Q') ||
        getBodySnippet().includes('FORM 8-K') ||
        getBodySnippet().includes('Item 1A') ||
        getBodySnippet().includes('UNITED STATES SECURITIES AND EXCHANGE COMMISSION');

      if (isSecContent) {
        return this.extractSecEdgar();
      }
    }

    // 2. Standalone Demo / Test Page with Filing Markup
    if (url.includes('demo.html')) {
      return this.extractSecEdgar();
    }

    // 3. Yahoo Finance (Quote, News, Markets, or Analysis articles)
    if (hostname.includes('finance.yahoo.com')) {
      return this.extractYahooFinance();
    }

    // 4. Seeking Alpha (Articles, Transcripts, Symbol pages)
    if (hostname.includes('seekingalpha.com')) {
      return this.extractSeekingAlpha();
    }

    // 5. TradingView (Symbol or Chart pages)
    if (hostname.includes('tradingview.com')) {
      if (pathname.includes('/symbols/') || pathname.includes('/chart/')) {
        return this.extractTradingView();
      }
    }

    // 6. MarketWatch (Stock quote or Story articles)
    if (hostname.includes('marketwatch.com')) {
      return this.extractMarketWatch();
    }

    // 7. Finviz (Quote pages)
    if (hostname.includes('finviz.com')) {
      if (url.includes('quote.ashx?t=')) {
        return this.extractFinviz();
      }
    }

    // 8. PDF Documents (.pdf URLs, embedded PDF viewers)
    if (
      pathname.endsWith('.pdf') ||
      url.includes('.pdf') ||
      (document.contentType && document.contentType.includes('pdf')) ||
      (typeof document !== 'undefined' && document.querySelector && document.querySelector('embed[type="application/pdf"]'))
    ) {
      return this.extractPdfDocument();
    }

    // Non-report or generic webpage fallback
    return this.extractUniversal();
  }

  /**
   * 1. SEC EDGAR Parser (Browse pages + Filing Documents)
   */
  static extractSecEdgar() {
    const title = document.title;
    let bodyText = document.body ? document.body.innerText : '';
    const url = window.location.href;
    let ticker = '';
    let company = '';
    let formType = 'Filing';
    let filingDate = '';
    let exchange = '';
    let sector = '';

    // Check if filing document is embedded inside an iframe (e.g. SEC Inline XBRL Viewer /ix?doc= or interactive viewers)
    const embeddedDocs = this.extractEmbeddedDocumentsSync();
    let embeddedFilingText = '';
    for (const doc of embeddedDocs) {
      if (doc.text && (
        doc.text.includes('10-K') || doc.text.includes('10-Q') || doc.text.includes('8-K') ||
        doc.text.includes('Item 1') || doc.text.includes('UNITED STATES SECURITIES') ||
        doc.text.includes('Risk Factors') || doc.text.includes('PART I')
      )) {
        embeddedFilingText += '\n\n' + doc.text;
      }
    }
    if (embeddedFilingText) {
      bodyText = embeddedFilingText + '\n\n' + bodyText;
    }

    // Parse URL params or URL path (e.g. /edgar/data/320193/...)
    const urlParams = new URLSearchParams(window.location.search);
    const pathCikMatch = url.match(/\/data\/(\d+)\//i);
    const cikParam = urlParams.get('CIK') || urlParams.get('cik') || (pathCikMatch ? pathCikMatch[1] : null);
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

    // Check body text for standard SEC header patterns (e.g. "Ticker Symbol: NWMC (NYSE)", "Company Name: Northwind Materials")
    const tickerMatch = bodyText.match(/(?:Ticker Symbol|Ticker|Symbol)[\s:]+([A-Z]{1,5})(?:\s*\(([A-Z]+)\))?/i);
    if (tickerMatch && tickerMatch[1]) {
      ticker = tickerMatch[1].toUpperCase().trim();
      if (tickerMatch[2]) exchange = tickerMatch[2].toUpperCase().trim();
    }
    const compMatch = bodyText.match(/(?:Company Name|Entity Name|Registrant Name|EXACT NAME OF REGISTRANT)[\s:]+([^\n\r]+)/i);
    if (compMatch && compMatch[1]) {
      const cleanComp = compMatch[1].replace(/Commission File Number.*/i, '').trim();
      if (cleanComp && cleanComp.length > 2 && !cleanComp.includes('EDGAR')) {
        company = cleanComp;
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
      businessText,
      hasEmbeddedDocuments: embeddedDocs.length > 0,
      embeddedDocuments: embeddedDocs,
      headlines: [
        `${company} (${ticker}) SEC filings and regulatory disclosures`,
        `Item 1A Risk Factors, MD&A, and capital allocation reports`,
      ],
      fullText: highSignalText,
    };
  }

  /**
   * Check if a ticker symbol or label represents a market index or benchmark
   */
  static isMarketIndex(symbol = '', text = '') {
    if (!symbol && !text) return false;
    const cleanSym = String(symbol || '').trim().toUpperCase();
    const cleanText = String(text || '').trim().toUpperCase();
    
    if (cleanSym.startsWith('^') || cleanSym.startsWith('%5E')) return true;
    if (MARKET_INDEX_SYMBOLS.has(cleanSym)) return true;
    
    if (
      cleanText.includes('S&P 500') ||
      cleanText.includes('DOW 30') ||
      cleanText.includes('DOW JONES') ||
      cleanText.includes('NASDAQ COMPOSITE') ||
      cleanText.includes('RUSSELL 2000') ||
      cleanText.includes('VOLATILITY INDEX') ||
      cleanText.includes('US MARKETS')
    ) {
      return true;
    }
    return false;
  }

  /**
   * Helper to format all-caps company names into clean Title Case
   */
  static toTitleCase(str = '') {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map((word) => {
        if (!word) return '';
        if (['inc.', 'inc', 'corp.', 'corp', 'llc', 'plc', 'ltd.', 'ltd', 'lp', 'nv', 'sa'].includes(word)) {
          return word.toUpperCase();
        }
        if (word === '&') return '&';
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Universal stock metadata resolver (checks POPULAR_COMPANIES, ALL_US_STOCKS, and KNOWN_CIKS)
   */
  static resolveStockMetadata(ticker = '') {
    if (!ticker) return { ticker: '', company: 'Company', cik: '', exchange: 'US' };
    const clean = String(ticker).toUpperCase().trim();

    // 1. Check POPULAR_COMPANIES if available in memory
    const popList = typeof POPULAR_COMPANIES !== 'undefined'
      ? POPULAR_COMPANIES
      : (typeof globalThis !== 'undefined' && globalThis.POPULAR_COMPANIES ? globalThis.POPULAR_COMPANIES : null);

    if (popList && Array.isArray(popList)) {
      const match = popList.find((p) => p.ticker === clean);
      if (match) {
        return {
          ticker: clean,
          company: match.title,
          cik: match.cik || '',
          exchange: match.exchange || 'US',
        };
      }
    }

    // 2. Check ALL_US_STOCKS complete American equities registry (10,412 stocks)
    const usRegistry = typeof ALL_US_STOCKS !== 'undefined'
      ? ALL_US_STOCKS
      : (typeof globalThis !== 'undefined' && globalThis.ALL_US_STOCKS ? globalThis.ALL_US_STOCKS : null);

    if (usRegistry && Array.isArray(usRegistry)) {
      const row = usRegistry.find((s) => s[0] === clean);
      if (row) {
        const cikFormatted = String(row[2] || '').padStart(10, '0');
        const formattedTitle = this.toTitleCase(row[1]);
        return {
          ticker: clean,
          company: formattedTitle,
          cik: cikFormatted,
          exchange: row[3] || 'US',
        };
      }
    }

    // 3. Check KNOWN_CIKS mapping
    const known = Object.values(KNOWN_CIKS).find((k) => k.ticker === clean);
    if (known) {
      const cikEntry = Object.entries(KNOWN_CIKS).find(([c, v]) => v.ticker === clean && c.length === 10);
      return {
        ticker: clean,
        company: known.company,
        cik: cikEntry ? cikEntry[0] : '',
        exchange: known.exchange || 'US',
      };
    }

    return { ticker: clean, company: clean, cik: '', exchange: 'US' };
  }

  /**
   * 2. Yahoo Finance Parser
   */
  static extractYahooFinance() {
    const path = window.location.pathname;
    const isQuote = path.includes('/quote/');
    
    // Clean title by stripping site suffixes
    const rawTitle = document.title || '';
    const cleanTitle = rawTitle.replace(/\s*[-–|]\s*Yahoo\s*(Finance|News).*$/i, '').trim();

    if (isQuote) {
      let ticker = '';
      let company = '';
      let exchange = 'US';
      let sector = 'Equities';

      const tickerMatch = path.match(/\/quote\/([A-Za-z0-9.%^=-]+)/i);
      if (tickerMatch) ticker = decodeURIComponent(tickerMatch[1]).toUpperCase();

      // 1. Try extracting company & ticker from document.title (standard format: "Apple Inc. (AAPL) Stock Price...")
      const titleMatch = rawTitle.match(/^([^(]+?)\s*\(\s*([A-Za-z0-9.%^=-]+)\s*\)/);
      if (titleMatch) {
        const tComp = titleMatch[1].trim();
        const tTick = decodeURIComponent(titleMatch[2]).toUpperCase();
        if (tComp && !tComp.toLowerCase().includes('yahoo')) {
          company = tComp;
        }
        if (!ticker && tTick) {
          ticker = tTick;
        }
      }

      // 2. Look for quote header in DOM (avoiding generic header h1 which may contain "Yahoo Finance")
      const quoteHeader = document.querySelector('section[data-testid="quote-hdr"] h1, div[data-testid="quote-hdr"] h1, [data-testid="quote-header"] h1, h1[class*="yf-"]');
      if (quoteHeader && quoteHeader.innerText) {
        const headerText = quoteHeader.innerText.trim();
        if (!headerText.toLowerCase().includes('yahoo')) {
          const parts = headerText.split('(');
          const hComp = parts[0].trim();
          if (hComp && !hComp.toLowerCase().includes('yahoo')) {
            company = hComp;
          }
          if (parts[1] && !ticker) {
            ticker = decodeURIComponent(parts[1].replace(')', '')).trim().toUpperCase();
          }
        }
      }

      // 3. Fallback to known registry if company is still empty, generic, or equals "Yahoo Finance"
      if (!company || company.toLowerCase().includes('yahoo') || company.toLowerCase() === 'company') {
        const resolved = this.resolveStockMetadata(ticker);
        if (resolved && resolved.company && resolved.company !== ticker) {
          company = resolved.company;
          if (resolved.exchange) exchange = resolved.exchange;
        } else if (ticker) {
          const cleanBeforePrice = cleanTitle.replace(/\s*(?:Stock Price|Stock Quote|Quote|History).*$/i, '').replace(/\s*\([A-Z0-9.-]+\)\s*/i, '').trim();
          if (cleanBeforePrice && !cleanBeforePrice.toLowerCase().includes('yahoo') && cleanBeforePrice.length < 50) {
            company = cleanBeforePrice;
          } else {
            company = ticker;
          }
        } else {
          company = 'Company';
        }
      }

      if (this.isMarketIndex(ticker, company)) {
        sector = 'Market Index';
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
        ticker: ticker || 'QUOTE',
        company,
        exchange,
        sector,
        formType: 'Equity Overview',
        filingDate: 'Live Feed',
        periodBadge: `${ticker || 'QUOTE'} · Realtime`,
        headlines: headlines.slice(0, 10),
        fullText: `Company: ${company} (${ticker})\n\nRecent News & Headlines:\n${headlines.join('\n')}\n\nCompany Overview & Metrics:\n${descText || cleanBody.slice(0, 15000)}`,
      };
    }

    // Article / Story on Yahoo Finance (e.g. /markets/stocks/articles/..., /news/...)
    return this.extractYahooFinanceArticle(cleanTitle);
  }

  /**
   * Intelligent Yahoo Finance Article Parser:
   * Scopes queries strictly inside the article body, filters out top-nav market index links
   * (e.g. S&P 500 / ^GSPC), extracts true subject stock from headline & article ticker pills,
   * and resolves full corporate metadata.
   */
  static extractYahooFinanceArticle(cleanTitle = '') {
    const path = window.location.pathname;

    // 1. Article Headline
    const h1El = document.querySelector('article h1, main h1, [data-test-id="article-header"] h1, .caas-title, .cover-title, h1[data-test-id="headline"], h1[class*="yf-"], h1');
    let articleHeadline = h1El && !h1El.innerText.toLowerCase().includes('yahoo')
      ? h1El.innerText.trim()
      : (cleanTitle && !cleanTitle.toLowerCase().includes('yahoo') ? cleanTitle : 'Market Article');

    // 2. Identify the article container strictly to avoid global #ybar / header market strip
    const articleContainer = document.querySelector('article, main, .caas-container, .caas-content, #main, [role="main"]') || document.body;

    // 3. Find ticker tags / quote pills inside the article container
    const articleTickers = [];
    if (articleContainer) {
      const quoteLinks = articleContainer.querySelectorAll(
        '[data-testid="quote-tags"] a, [data-testid="ticker-container"] a, [data-testid="ticker-list"] a, ' +
        '.caas-ticker-container a, .caas-header a[href*="/quote/"], .yf-quote-tag, a[data-testid="ticker-container"], ' +
        'a.quote-tag, a[href*="/quote/"]'
      );

      quoteLinks.forEach((link) => {
        // Skip any link inside global header/navbar/market overview strip
        if (link.closest('#ybar, header, nav, .market-strip, [data-module="MarketOverview"], [data-testid="market-indices"], [data-testid="market-strip"], aside, footer')) {
          return;
        }

        const href = link.getAttribute('href') || '';
        const hrefMatch = href.match(/\/quote\/([A-Za-z0-9.%^=-]+)/i);
        let sym = hrefMatch ? decodeURIComponent(hrefMatch[1]).trim().toUpperCase() : '';
        if (!sym && link.innerText) {
          sym = link.innerText.replace(/[^A-Za-z0-9.-]/g, '').trim().toUpperCase();
        }

        // Filter out market indices and benchmarks
        if (sym && !this.isMarketIndex(sym, link.innerText) && sym.length <= 6) {
          if (!articleTickers.includes(sym)) {
            articleTickers.push(sym);
          }
        }
      });
    }

    // 4. Intelligently determine the PRIMARY subject stock of this article
    let primaryTicker = '';

    // Check A: Does any article ticker appear in the headline? (e.g. "Was JNJ Stock Rally..." -> JNJ)
    for (const t of articleTickers) {
      if (new RegExp(`\\b${t}\\b`, 'i').test(articleHeadline)) {
        primaryTicker = t;
        break;
      }
    }

    // Check B: Does any company name matching article tickers appear in the headline?
    if (!primaryTicker) {
      for (const t of articleTickers) {
        const meta = this.resolveStockMetadata(t);
        const coreComp = meta.company.replace(/\s+(Inc\.|Corporation|Corp\.|Company|Co\.|Holdings|plc).*$/i, '').trim();
        if (coreComp.length > 3 && new RegExp(`\\b${coreComp}\\b`, 'i').test(articleHeadline)) {
          primaryTicker = t;
          break;
        }
      }
    }

    // Check C: Headline ticker pattern recognition (e.g. "Was JNJ Stock...", "(JNJ)", "$JNJ", "NYSE: JNJ")
    if (!primaryTicker) {
      const explicitMatches = articleHeadline.match(/\b(?:NYSE|NASDAQ|AMEX):\s*([A-Z]{1,5})\b|\(([A-Z]{1,5})\)|\$([A-Z]{1,5})\b/i);
      if (explicitMatches) {
        const found = (explicitMatches[1] || explicitMatches[2] || explicitMatches[3] || '').toUpperCase();
        if (found && !this.isMarketIndex(found) && !COMMON_HEADLINE_WORDS.has(found)) {
          primaryTicker = found;
        }
      }
    }

    // Check D: Scan uppercase words in the headline against US stocks registry
    if (!primaryTicker) {
      const words = articleHeadline.match(/\b[A-Z]{1,5}\b/g) || [];
      for (const w of words) {
        const sym = w.toUpperCase();
        if (!COMMON_HEADLINE_WORDS.has(sym) && !this.isMarketIndex(sym)) {
          const resolved = this.resolveStockMetadata(sym);
          if (resolved && resolved.company && resolved.company !== sym) {
            primaryTicker = sym;
            break;
          }
        }
      }
    }

    // Check E: URL path slug check (e.g. /articles/jnj-rally-... or /news/why-jnj-stock-...)
    if (!primaryTicker && path) {
      for (const t of articleTickers) {
        const lowT = t.toLowerCase();
        if (path.includes(`/${lowT}-`) || path.includes(`-${lowT}-`) || path.includes(`-${lowT}/`)) {
          primaryTicker = t;
          break;
        }
      }
    }

    // Check F: First non-index article ticker chip
    if (!primaryTicker && articleTickers.length > 0) {
      primaryTicker = articleTickers[0];
    }

    // Fallback: If no stock could be identified, classify as general Market Analysis
    if (!primaryTicker) {
      primaryTicker = 'MARKET';
    }

    // 5. Resolve Corporate Metadata
    let primaryCompany = articleHeadline;
    let exchange = 'News';
    let cik = '';

    if (primaryTicker && primaryTicker !== 'MARKET' && primaryTicker !== 'ARTICLE') {
      const meta = this.resolveStockMetadata(primaryTicker);
      primaryCompany = meta.company || primaryTicker;
      exchange = meta.exchange || 'NYSE';
      cik = meta.cik || '';
    } else {
      primaryCompany = articleHeadline && !articleHeadline.toLowerCase().includes('yahoo') ? articleHeadline : 'Market Analysis';
    }

    // 6. Build list of discussed stocks in this article
    const validStocksMap = new Map();
    if (primaryTicker && primaryTicker !== 'MARKET') {
      const pMeta = this.resolveStockMetadata(primaryTicker);
      validStocksMap.set(primaryTicker, { ticker: primaryTicker, company: pMeta.company, cik: pMeta.cik });
    }
    articleTickers.forEach((t) => {
      if (!validStocksMap.has(t)) {
        const m = this.resolveStockMetadata(t);
        validStocksMap.set(t, { ticker: t, company: m.company, cik: m.cik });
      }
    });
    const discussedStocks = Array.from(validStocksMap.values());

    // 7. Extract main article body with ads stripped
    const articleBodyEl = document.querySelector('.caas-body, article, div.body, [data-testid="article-body"], main');
    const sourceEl = articleBodyEl || document.body;
    let articleText = '';
    if (sourceEl) {
      const clone = typeof sourceEl.cloneNode === 'function' ? sourceEl.cloneNode(true) : null;
      if (clone) {
        this.stripAdsFromElement(clone);
        articleText = this.cleanSectionText(clone.innerText || clone.textContent || '');
      } else {
        articleText = this.cleanSectionText(sourceEl.innerText || sourceEl.textContent || '');
      }
    }

    return {
      isFinanceSite: true,
      isReportPage: true,
      siteType: 'yahoo_finance_article',
      ticker: primaryTicker,
      company: primaryCompany,
      exchange,
      cik,
      sector: 'Market Analysis',
      formType: 'Market Article',
      filingDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      periodBadge: `Article · ${primaryTicker}`,
      headlines: [articleHeadline],
      discussedStocks,
      fullText: `Article Headline: ${articleHeadline}\nSubject Company: ${primaryCompany} (${primaryTicker})\n\nArticle Content:\n${articleText.slice(0, 18000)}`,
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
    const sourceEl = articleBody || document.body;
    let cleanContent = '';
    if (sourceEl) {
      const clone = typeof sourceEl.cloneNode === 'function' ? sourceEl.cloneNode(true) : null;
      if (clone) {
        this.stripAdsFromElement(clone);
        cleanContent = this.cleanSectionText(clone.innerText || clone.textContent || '');
      } else {
        cleanContent = this.cleanSectionText(sourceEl.innerText || sourceEl.textContent || '');
      }
    }

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
   * Helper to detect if a generic webpage contains finance/market signals
   */
  static isFinancialContent(text = '', title = '', url = '') {
    const combined = `${url} ${title} ${text.slice(0, 16000)}`.toLowerCase();
    const financialTerms = [
      'revenue', 'gross margin', 'operating margin', 'net income', 'ebitda',
      'earnings report', 'earnings call', 'quarterly results', 'fiscal year',
      'balance sheet', 'cash flow', 'free cash flow', 'shareholder', 'dividend',
      'sec filing', 'form 10-k', 'form 10-q', 'form 8-k', 'form 20-f', 'form s-1',
      'risk factors', 'capex', 'capital expenditure', 'market cap', 'eps',
      'investor relations', 'nasdaq:', 'nyse:', 'debt maturity', 'operating cash flow',
      'stock price', 'financial statements', 'quarterly earnings', 'annual report',
      'guidance', 'profitability'
    ];

    let matches = 0;
    for (const term of financialTerms) {
      if (combined.includes(term)) {
        matches++;
      }
    }
    return matches >= 2;
  }

  /**
   * PDF Document Parser
   */
  static extractPdfDocument() {
    const rawTitle = document.title || '';
    const pathname = window.location.pathname || '';
    const filename = pathname.split('/').pop().replace(/\.pdf$/i, '') || 'Financial Report';
    const cleanName = decodeURIComponent(filename).replace(/[-_]/g, ' ');
    const pageTitle = (rawTitle && !rawTitle.endsWith('.pdf') && rawTitle !== cleanName) ? rawTitle : cleanName;

    // Check if innerText or embedded document text is present
    const embeddedDocs = this.extractEmbeddedDocumentsSync();
    let bodyText = document.body ? this.cleanSectionText(document.body.innerText) : '';
    for (const d of embeddedDocs) {
      if (d.text && d.text.length > 50) {
        bodyText = (bodyText ? bodyText + '\n\n' : '') + d.text;
      }
    }
    const isFinancial = this.isFinancialContent(bodyText, pageTitle, window.location.href);

    let ticker = 'PDF';
    let company = pageTitle.slice(0, 60);
    let exchange = isFinancial ? 'Financial PDF' : 'PDF Document';

    // Detect Berkshire Hathaway or known companies in document
    const lowerBody = (bodyText + ' ' + pageTitle).toLowerCase();
    if (lowerBody.includes('berkshire hathaway')) {
      ticker = 'BRK.B';
      company = 'Berkshire Hathaway Inc.';
      exchange = 'NYSE';
    } else {
      for (const [cik, info] of Object.entries(KNOWN_CIKS)) {
        if (lowerBody.includes(info.company.toLowerCase()) || (info.ticker && lowerBody.includes(info.ticker.toLowerCase()))) {
          ticker = info.ticker;
          company = info.company;
          exchange = info.exchange || exchange;
          break;
        }
      }
    }

    return {
      isFinanceSite: isFinancial,
      isReportPage: isFinancial,
      siteType: 'pdf_document',
      ticker,
      company,
      exchange,
      sector: isFinancial ? 'Financial Analysis' : 'PDF Document',
      formType: isFinancial ? 'PDF Report' : 'PDF File',
      filingDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      periodBadge: 'PDF Document',
      headlines: [pageTitle],
      hasEmbeddedDocuments: embeddedDocs.length > 0,
      embeddedDocuments: embeddedDocs,
      fullText: bodyText && bodyText.length > 50
        ? `Topic / Document: ${pageTitle}\n\nExtracted Content:\n${bodyText.slice(0, 24000)}`
        : `Topic / Document: ${pageTitle} (PDF Document)\n\nURL: ${window.location.href}`,
    };
  }

  /**
   * 7. Universal Fallback for any general page
   */
  static extractUniversal() {
    const rawTitle = document.title || 'Web Document';
    const cleanTitle = rawTitle
      .replace(/\s*[-–|]\s*(Yahoo\s*Finance|Bloomberg|Reuters|CNBC|Seeking\s*Alpha|MarketWatch|Financial\s*Times|WSJ|Wall\s*Street\s*Journal|Forbes|CNN|Business\s*Insider|TechCrunch|The\s*Verge|Medium|Substack).*$/i, '')
      .trim();

    const h1 = document.querySelector('article h1, main h1, h1');
    const pageHeading = h1 ? h1.innerText.trim() : (cleanTitle || 'Web Article');

    // Extract any documents opened inside the webpage (iframes, embedded PDFs, in-page viewers, shadow DOM)
    const embeddedDocs = this.extractEmbeddedDocumentsSync();
    let embeddedText = '';
    for (const doc of embeddedDocs) {
      if (doc.text && doc.text.length > 50) {
        embeddedText += `\n\n${doc.text}\n`;
      }
    }

    // Clean body text by extracting main article container or stripping ads and noise
    const mainEl = document.querySelector('article, main, .article-content, .post-content, #content, .content');
    const sourceEl = mainEl || document.body;

    const clone = (sourceEl && typeof sourceEl.cloneNode === 'function') ? sourceEl.cloneNode(true) : null;
    if (clone) {
      this.stripAdsFromElement(clone);
      clone.querySelectorAll('iframe').forEach((el) => el.remove());
    }

    let cleanText = clone ? this.cleanSectionText(clone.innerText) : (sourceEl ? this.cleanSectionText(sourceEl.innerText || sourceEl.textContent || '') : '');
    if (embeddedText) {
      cleanText = embeddedText + '\n\n' + cleanText;
    }

    let isFinancial = this.isFinancialContent(cleanText, rawTitle, window.location.href);
    if (!isFinancial && embeddedDocs.some((d) => d.isFinancial || (d.title && /10-k|10-q|8-k|annual report|quarterly report|filing|shareholder/i.test(d.title)))) {
      isFinancial = true;
    }

    let ticker = 'PAGE';
    let company = pageHeading.slice(0, 60);
    let exchange = isFinancial ? 'Financial Media' : 'Web';

    const lowerCombined = `${pageHeading} ${rawTitle} ${cleanText.slice(0, 3000)}`.toLowerCase();
    if (lowerCombined.includes('berkshire hathaway')) {
      ticker = 'BRK.B';
      company = 'Berkshire Hathaway Inc.';
      exchange = 'NYSE';
    } else {
      for (const [cik, info] of Object.entries(KNOWN_CIKS)) {
        if (lowerCombined.includes(info.company.toLowerCase()) || (info.ticker && lowerCombined.includes(`(${info.ticker.toLowerCase()})`))) {
          ticker = info.ticker;
          company = info.company;
          exchange = info.exchange || exchange;
          break;
        }
      }
    }

    // Detect ticker, company, and formType from embedded documents or cleanText
    const tickerMatch = cleanText.match(/(?:Ticker Symbol|Ticker|Symbol)[\s:]+([A-Z]{1,5})(?:\s*\(([A-Z]+)\))?/i);
    if (tickerMatch && tickerMatch[1] && ticker === 'PAGE') {
      ticker = tickerMatch[1].toUpperCase().trim();
      if (tickerMatch[2]) exchange = tickerMatch[2].toUpperCase().trim();
    }
    const compMatch = cleanText.match(/(?:Company Name|Entity Name|Registrant Name|EXACT NAME OF REGISTRANT)[\s:]+([^\n\r]+)/i);
    if (compMatch && compMatch[1] && (company === pageHeading.slice(0, 60) || company.includes('Document') || company.includes('Portal') || company.includes('Viewer'))) {
      const cleanComp = compMatch[1].replace(/Commission File Number.*/i, '').trim();
      if (cleanComp && cleanComp.length > 2 && !cleanComp.includes('EDGAR')) {
        company = cleanComp;
      }
    }

    let formType = isFinancial ? 'Article / Report' : 'General Document';
    const combinedDocSources = `${cleanText} ${embeddedDocs.map((d) => d.title || '').join(' ')}`;
    if (combinedDocSources.includes('FORM 10-K') || combinedDocSources.includes('10-K')) formType = '10-K';
    else if (combinedDocSources.includes('FORM 10-Q') || combinedDocSources.includes('10-Q')) formType = '10-Q';
    else if (combinedDocSources.includes('FORM 8-K') || combinedDocSources.includes('8-K')) formType = '8-K';

    return {
      isFinanceSite: isFinancial,
      isReportPage: isFinancial,
      siteType: isFinancial ? 'financial_web' : 'generic_web',
      ticker,
      company,
      exchange,
      sector: isFinancial ? 'Financial Analysis' : 'General Webpage',
      formType,
      filingDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      periodBadge: isFinancial ? `${ticker !== 'PAGE' ? ticker + ' · ' : ''}${formType}` : 'General Page',
      headlines: [pageHeading],
      hasEmbeddedDocuments: embeddedDocs.length > 0,
      embeddedDocuments: embeddedDocs,
      fullText: `Topic / Headline: ${pageHeading}\n\nContent:\n${cleanText.slice(0, 24000)}`,
    };
  }

  /**
   * Deep extraction of documents opened inside the webpage:
   * - <iframe> documents (same-origin DOM or cross-origin URLs)
   * - <embed> and <object> documents (PDFs, reports)
   * - In-page PDF text layers (.textLayer, .pdfViewer, .pdf-page-sheet)
   * - Custom web component document readers (Shadow DOM)
   */
  static extractEmbeddedDocumentsSync() {
    const docs = [];

    // 1. Check all <iframe> elements on the page
    try {
      const iframes = Array.from(document.querySelectorAll('iframe'));
      for (const iframe of iframes) {
        if (iframe.id === 'prospectus-sidebar-iframe' || (iframe.closest && iframe.closest('#prospectus-root'))) {
          continue;
        }

        // Exclude advertising, tracking pixels, analytics, and promo widget iframes
        const src = (iframe.src || '').toLowerCase();
        const id = (iframe.id || '').toLowerCase();
        const className = (iframe.className || '').toLowerCase();

        // Check if iframe dimensions indicate a tracking pixel or hidden ad frame
        try {
          const w = iframe.width || iframe.offsetWidth;
          const h = iframe.height || iframe.offsetHeight;
          if ((w !== undefined && w <= 1 && w > 0) || (h !== undefined && h <= 1 && h > 0)) {
            continue;
          }
        } catch (e) {}

        const adKeywords = [
          'googleads', 'doubleclick', 'pagead', 'googlesyndication', 'adnxs', 'adsystem',
          'advertising', 'outbrain', 'taboola', 'criteo', 'revcontent', 'media.net',
          'mgid', 'zedo', 'adroll', 'rubiconproject', 'pubmatic', 'openx', 'smartadserver',
          'adtech', 'amazon-adsystem', 'bidswitch', 'casalemedia', 'appnexus',
          'scorecardresearch', 'moatads', 'yieldmo', 'chartbeat', 'quantserve',
          'facebook', 'twitter', 'disqus', 'recaptcha', 'ad-', 'ads-', 'advert',
          'sponsored', 'promoted', 'banner-ad', 'dfp', 'trc_related'
        ];
        if (adKeywords.some((kw) => src.includes(kw) || id.includes(kw) || className.includes(kw))) {
          continue;
        }

        let docText = '';
        let docTitle = iframe.title || iframe.getAttribute('name') || '';

        // Try reading contentDocument (if same-origin / accessible)
        try {
          const iDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iDoc && iDoc.body) {
            // Check for in-iframe PDF.js text layer first
            const textLayers = (typeof iDoc.querySelectorAll === 'function')
              ? iDoc.querySelectorAll('.textLayer, .pdfViewer, .page, div[data-page-number]')
              : [];
            if (textLayers.length > 0) {
              const pageTexts = [];
              textLayers.forEach((layer) => {
                const spans = Array.from(layer.querySelectorAll('span, div, p'));
                if (spans.length > 0) {
                  pageTexts.push(spans.map((s) => s.innerText || s.textContent || '').join(' '));
                } else if (layer.innerText) {
                  pageTexts.push(layer.innerText);
                }
              });
              const combined = pageTexts.join('\n\n').trim();
              if (combined.length > 50) docText = combined;
            }

            if (!docText) {
              const clone = (iDoc.body && typeof iDoc.body.cloneNode === 'function') ? iDoc.body.cloneNode(true) : null;
              if (clone) {
                this.stripAdsFromElement(clone);
                docText = this.cleanSectionText(clone.innerText || clone.textContent || '');
              } else if (iDoc.body) {
                docText = this.cleanSectionText(iDoc.body.innerText || iDoc.body.textContent || '');
              }
            }

            if (!docTitle && iDoc.title) {
              docTitle = iDoc.title;
            }
          }
        } catch (crossOriginErr) {
          // Cross-origin iframe
        }

        if (docText && docText.length > 60) {
          docs.push({
            type: 'iframe_document',
            title: docTitle || 'Embedded Document',
            url: iframe.src || window.location.href,
            text: docText,
            isFinancial: this.isFinancialContent(docText, docTitle, iframe.src || ''),
          });
        } else if (src && (src.includes('.pdf') || src.includes('/ix?doc=') || src.includes('.htm') || src.includes('doc=') || src.includes('file='))) {
          docs.push({
            type: src.includes('.pdf') ? 'embedded_pdf_url' : 'embedded_doc_url',
            title: docTitle || 'Embedded Document',
            url: iframe.src,
            text: '',
            isFinancial: true,
          });
        }
      }
    } catch (e) {}

    // 2. Check <embed> and <object> elements (PDFs, embedded reports)
    try {
      const embeds = Array.from(document.querySelectorAll('embed, object'));
      for (const el of embeds) {
        if (el.closest && el.closest('#prospectus-root')) continue;
        const src = el.src || el.getAttribute('data') || '';
        const type = (el.type || el.getAttribute('type') || '').toLowerCase();
        if (src && (type.includes('pdf') || src.toLowerCase().includes('.pdf'))) {
          docs.push({
            type: 'embedded_pdf_url',
            title: el.getAttribute('title') || 'Embedded PDF Document',
            url: src,
            text: '',
            isFinancial: true,
          });
        }
      }
    } catch (e) {}

    // 3. In-page PDF.js / textLayer viewers in main DOM
    try {
      const textLayers = document.querySelectorAll('.textLayer, .pdfViewer, .pdf-page-sheet, div[data-page-number]');
      if (textLayers.length > 0) {
        const pageTexts = [];
        textLayers.forEach((layer) => {
          const spans = Array.from(layer.querySelectorAll('span, div, p'));
          if (spans.length > 0) {
            pageTexts.push(spans.map((s) => s.innerText || s.textContent || '').join(' '));
          } else if (layer.innerText) {
            pageTexts.push(layer.innerText);
          }
        });
        const combined = pageTexts.join('\n\n').trim();
        if (combined.length > 60) {
          docs.push({
            type: 'pdf_text_layer',
            title: document.title || 'In-Page Document',
            url: window.location.href,
            text: combined,
            isFinancial: this.isFinancialContent(combined, document.title, window.location.href),
          });
        }
      }
    } catch (e) {}

    // 4. Custom web components / readers in Shadow DOM
    try {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.id === 'prospectus-root' || (el.closest && el.closest('#prospectus-root'))) continue;
        if (el.shadowRoot) {
          const sText = el.shadowRoot.innerText || el.shadowRoot.textContent || '';
          if (sText.length > 200) {
            docs.push({
              type: 'shadow_dom_document',
              title: el.tagName.toLowerCase().replace(/[-_]/g, ' '),
              url: window.location.href,
              text: this.cleanSectionText(sText),
              isFinancial: this.isFinancialContent(sText, '', window.location.href),
            });
          }
        }
      }
    } catch (e) {}

    return docs;
  }

  /**
   * Deep asynchronous document extraction for all documents opened inside the webpage:
   * - Traverses iframes, embed/object tags, in-page PDF viewers, and shadow DOM
   * - If an iframe or embed is cross-origin or local file, fetches the document via
   *   extension permissions or background proxy (FETCH_PROXY / FETCH_PDF_TEXT)
   * - Parses HTML or PDF streams and extracts full text & high-signal financial sections
   */
  static async extractEmbeddedDocumentsAsync() {
    const docs = this.extractEmbeddedDocumentsSync();

    for (const doc of docs) {
      if ((!doc.text || doc.text.length < 50) && doc.url) {
        try {
          const lowerUrl = doc.url.toLowerCase();

          if (lowerUrl.includes('.pdf')) {
            let pdfText = '';
            if (typeof window.ProspectusPDFExtractor !== 'undefined' || typeof PDFExtractor !== 'undefined') {
              const ext = window.ProspectusPDFExtractor || PDFExtractor;
              pdfText = await ext.extractFromUrl(doc.url);
            }
            if (!pdfText && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
              const bgRes = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: 'FETCH_PDF_TEXT', url: doc.url }, (r) => {
                  if (chrome.runtime.lastError) return resolve(null);
                  resolve(r);
                });
              });
              if (bgRes && bgRes.success && bgRes.text) pdfText = bgRes.text;
            }
            if (pdfText && pdfText.trim().length > 30) {
              doc.text = pdfText.trim();
              doc.isFinancial = this.isFinancialContent(pdfText, doc.title, doc.url);
            }
          } else {
            let htmlText = '';
            try {
              const res = await fetch(doc.url);
              if (res.ok) htmlText = await res.text();
            } catch (fetchErr) {
              if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                const bgRes = await new Promise((resolve) => {
                  chrome.runtime.sendMessage({ action: 'FETCH_PROXY', url: doc.url }, (r) => {
                    if (chrome.runtime.lastError) return resolve(null);
                    resolve(r);
                  });
                });
                if (bgRes && bgRes.success && bgRes.text) htmlText = bgRes.text;
              }
            }

            if (htmlText && htmlText.length > 50) {
              const parser = new DOMParser();
              const parsedDoc = parser.parseFromString(htmlText, 'text/html');
              this.stripAdsFromElement(parsedDoc.body || parsedDoc);
              const extractedText = this.cleanSectionText(parsedDoc.body ? parsedDoc.body.innerText : '');

              if (extractedText.length > 50) {
                doc.text = extractedText;
                doc.title = doc.title || (parsedDoc.title ? parsedDoc.title.trim() : 'Embedded Document');
                doc.isFinancial = this.isFinancialContent(extractedText, doc.title, doc.url);

                // Detect SEC filings sections inside the embedded document
                if (extractedText.includes('10-K') || extractedText.includes('10-Q') || extractedText.includes('8-K') || extractedText.includes('Item 1A') || extractedText.includes('Risk Factors')) {
                  const riskMatch = extractedText.match(/Item\s+1A[\.\s–-]+Risk\s+Factors([\s\S]{300,30000}?)(?:Item\s+(?:1B|2|3|4|7)\b|$)/i);
                  if (riskMatch && riskMatch[1]) doc.riskFactorsText = this.cleanSectionText(riskMatch[1]);

                  const mdaMatch = extractedText.match(/Item\s+(?:7|2)[\.\s–-]+Management(?:'s)?\s+Discussion([\s\S]{300,30000}?)(?:Item\s+(?:7A|8|3)\b|$)/i);
                  if (mdaMatch && mdaMatch[1]) doc.mdaText = this.cleanSectionText(mdaMatch[1]);

                  const bizMatch = extractedText.match(/Item\s+1[\.\s–-]+Business([\s\S]{300,20000}?)(?:Item\s+1A\b|$)/i);
                  if (bizMatch && bizMatch[1]) doc.businessText = this.cleanSectionText(bizMatch[1]);

                  const tickerMatch = extractedText.match(/(?:Ticker Symbol|Ticker|Symbol)[\s:]+([A-Z]{1,5})(?:\s*\(([A-Z]+)\))?/i);
                  if (tickerMatch && tickerMatch[1]) doc.ticker = tickerMatch[1].toUpperCase().trim();

                  const compMatch = extractedText.match(/(?:Company Name|Entity Name|Registrant Name|EXACT NAME OF REGISTRANT)[\s:]+([^\n\r]+)/i);
                  if (compMatch && compMatch[1]) doc.company = compMatch[1].replace(/Commission File Number.*/i, '').trim();
                }
              }
            }
          }
        } catch (e) {
          // Ignore embedded doc extraction errors silently
        }
      }
    }

    return docs;
  }

  /**
   * Complete selector registry for advertisements, sponsored containers, promo banners, and marketing widgets
   */
  static AD_SELECTORS = [
    'script', 'style', 'nav', 'footer', 'header', 'noscript',
    '#prospectus-root', 'ins.adsbygoogle', '.adsbygoogle',
    '.ad', '.ads', '.advert', '.advertisement', '.advertising',
    '.ad-slot', '.ad-slots', '.ad-banner', '.ad-wrapper', '.ad-container', '.ad-box', '.ad-unit',
    '.ad-holder', '.ad-placement', '.ad-zone', '.ad-card', '.ad-module', '.ad-wrapper-desktop',
    '.banner-ad', '.sidebar-ad', '.top-ad', '.bottom-ad', '.inline-ad', '.content-ad',
    '[class*="ad-slot"]', '[class*="ad-banner"]', '[class*="ad-container"]', '[class*="advertisement"]',
    '[id*="ad-slot"]', '[id*="ad-banner"]', '[id*="ad-container"]', '[id*="advertisement"]',
    '[id*="google_ads"]', '[id*="div-gpt-ad"]', '[class*="dfp-"]', '[id*="dfp-"]',
    '[class*="taboola"]', '[id*="taboola"]', '.trc_related_container', '.trc_rbox_container',
    '[class*="outbrain"]', '[id*="outbrain"]', '.OUTBRAIN',
    '[class*="revcontent"]', '[id*="revcontent"]',
    '[class*="zergnet"]', '[id*="zergnet"]',
    '[class*="criteo"]', '[id*="criteo"]',
    '.mgid', '.pubmatic', '.rubicon', '.amazon-ad',
    '.sponsored', '.sponsored-content', '.sponsored-post', '.sponsored-article',
    '.promoted', '.promoted-content', '.promoted-post', '.paid-content', '.native-ad',
    '[data-ad]', '[data-ad-unit]', '[data-ad-client]', '[data-ad-slot]', '[data-google-query-id]',
    '.newsletter', '.newsletter-signup', '.newsletter-box', '.subscribe-banner',
    '.subscription-prompt', '.paywall-prompt', '.promo-banner', '.promo-box',
    '.interstitial', '.outstream', '.commercial',
    '.cookie-banner', '.cookie-notice', '.cookie-consent', '.consent-banner',
    '.onetrust-consent-sdk', '#onetrust-banner-sdk', '.qc-cmp-ui-container',
    'aside', '.sidebar', '.social-share', '.share-buttons', '.social-bar', '.comments', '#comments', '.disqus',
    '#ybar', '.market-strip', '[data-module="MarketOverview"]', '[data-testid="market-indices"]', '[data-testid="market-strip"]'
  ];

  /**
   * Recursively strips advertisement elements and commercial widgets from a DOM element
   */
  static stripAdsFromElement(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return root;
    for (const sel of this.AD_SELECTORS) {
      try {
        root.querySelectorAll(sel).forEach((el) => {
          if (el.id === 'prospectus-root' || (el.closest && el.closest('#prospectus-root'))) return;
          el.remove();
        });
      } catch (e) {}
    }
    return root;
  }

  /**
   * Filters out standalone promotional labels, ad disclaimers, and marketing boilerplate from text
   */
  static stripAdText(text) {
    if (!text) return '';
    const adLinePatterns = [
      /^\s*(?:advertisement|advertisements|sponsored|sponsored content|promoted stories|promoted content|paid partner content|partner content)[\s:–-]*$/i,
      /^\s*(?:adchoices|ad choices|report (?:this )?ad|advertisement continued below)[\s:–-]*$/i,
      /^\s*(?:recommended for you|you may also like|trending stories|trending news|around the web)[\s:–-]*$/i,
      /^\s*(?:subscribe now for unlimited access|sign up for our free newsletter|click here to subscribe|subscribe to continue reading)[\s:–-]*$/i,
      /^\s*(?:we use cookies to improve your experience|accept all cookies|cookie policy|manage consent|we value your privacy)[\s:–-]*$/i,
      /^\s*(?:this article contains affiliate links|we may earn an affiliate commission)[\s:–-]*$/i,
      /^\s*share this (?:article|story) on (?:facebook|twitter|x|linkedin)[\s:–-]*$/i,
    ];

    const lines = text.split('\n');
    const cleanLines = [];
    let skippingAdBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        cleanLines.push('');
        continue;
      }

      // Check if line is an ad banner or header
      if (/^\s*(?:advertisement|sponsored content|promoted stories|ad choices|adchoices)[\s:–-]*$/i.test(trimmed)) {
        skippingAdBlock = true;
        continue;
      }

      // Check other ad patterns
      if (adLinePatterns.some((pattern) => pattern.test(trimmed))) {
        continue;
      }

      // Stop skipping ad block if we hit a substantive sentence or financial disclosure
      if (skippingAdBlock) {
        if (trimmed.length > 70 || /^(?:item\s+\d|revenue|net income|operating|the company|in fiscal|sales|guidance|risk factors|balance sheet)/i.test(trimmed)) {
          skippingAdBlock = false;
          cleanLines.push(line);
        }
        continue;
      }

      cleanLines.push(line);
    }

    return cleanLines.join('\n');
  }

  /**
   * Helper to strip advertisements, boilerplate headers, excessive whitespace, and repetitive table markers
   */
  static cleanSectionText(text) {
    if (!text) return '';
    const withoutAds = this.stripAdText(text);
    return withoutAds
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
