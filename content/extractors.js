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
    const bodyText = document.body ? document.body.innerText : '';
    const url = window.location.href;
    let ticker = '';
    let company = '';
    let formType = 'Filing';
    let filingDate = '';
    let exchange = '';
    let sector = '';

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
    const isQuote = path.includes('/quote/');
    
    // Clean title by stripping site suffixes
    const rawTitle = document.title || '';
    const cleanTitle = rawTitle.replace(/\s*[-–|]\s*Yahoo\s*(Finance|News).*$/i, '').trim();

    if (isQuote) {
      let ticker = '';
      let company = '';
      let exchange = 'US';
      let sector = 'Equities';

      const tickerMatch = path.match(/\/quote\/([A-Za-z0-9.-]+)/i);
      if (tickerMatch) ticker = tickerMatch[1].toUpperCase();

      // 1. Try extracting company & ticker from document.title (standard format: "Apple Inc. (AAPL) Stock Price...")
      const titleMatch = rawTitle.match(/^([^(]+?)\s*\(\s*([A-Za-z0-9.-]+)\s*\)/);
      if (titleMatch) {
        const tComp = titleMatch[1].trim();
        const tTick = titleMatch[2].toUpperCase();
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
            ticker = parts[1].replace(')', '').trim().toUpperCase();
          }
        }
      }

      // 3. Fallback to known registry if company is still empty, generic, or equals "Yahoo Finance"
      if (!company || company.toLowerCase().includes('yahoo') || company.toLowerCase() === 'company') {
        const knownMatch = Object.values(KNOWN_CIKS).find((k) => k.ticker === ticker);
        if (knownMatch && knownMatch.company) {
          company = knownMatch.company;
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
    const h1El = document.querySelector('article h1, main h1, h1.yf-xx');
    const articleHeadline = h1El && !h1El.innerText.toLowerCase().includes('yahoo')
      ? h1El.innerText.trim()
      : (cleanTitle && !cleanTitle.toLowerCase().includes('yahoo') ? cleanTitle : 'Market Article');

    // Detect mentioned company or ticker from article
    let ticker = '';
    const tickerTag = document.querySelector('a[data-testid="ticker-container"], .yf-quote-tag, a[href*="/quote/"]');
    if (tickerTag && tickerTag.innerText) {
      ticker = tickerTag.innerText.replace(/[^A-Za-z0-9.-]/g, '').trim().toUpperCase();
    }

    // If a stock ticker was identified from the article, resolve the stock company name
    let companyName = articleHeadline;
    if (ticker && ticker !== 'ARTICLE') {
      const knownMatch = Object.values(KNOWN_CIKS).find((k) => k.ticker === ticker);
      companyName = knownMatch ? knownMatch.company : ticker;
    } else if (companyName.toLowerCase().includes('yahoo')) {
      companyName = 'Market Article';
    }

    // Extract main article body
    const articleBodyEl = document.querySelector('.caas-body, article, div.body, [data-testid="article-body"], main');
    const articleText = articleBodyEl ? this.cleanSectionText(articleBodyEl.innerText) : this.cleanSectionText(document.body ? document.body.innerText : '');

    return {
      isFinanceSite: true,
      isReportPage: true,
      siteType: 'yahoo_finance_article',
      ticker: ticker || 'ARTICLE',
      company: companyName,
      exchange: 'News',
      sector: 'Market Analysis',
      formType: 'Market Article',
      filingDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      periodBadge: `Article · ${ticker || 'Market'}`,
      headlines: [articleHeadline],
      fullText: `Article Headline: ${articleHeadline}\n\nArticle Content:\n${articleText.slice(0, 18000)}`,
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

    // Check if innerText or embedded text is present
    const bodyText = document.body ? this.cleanSectionText(document.body.innerText) : '';
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
      fullText: bodyText && bodyText.length > 50
        ? `Topic / Document: ${pageTitle}\n\nExtracted Content:\n${bodyText.slice(0, 20000)}`
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

    // Clean body text by extracting main article container or stripping noise
    const mainEl = document.querySelector('article, main, .article-content, .post-content, #content, .content');
    const sourceEl = mainEl || document.body;

    const clone = sourceEl ? sourceEl.cloneNode(true) : null;
    if (clone) {
      const removeSelectors = [
        'script', 'style', 'nav', 'footer', 'header', 'noscript', 'iframe',
        '#prospectus-root', '.cookie-banner', '.advertisement', '.ad-slot',
        'aside', '.sidebar', '.social-share', '.comments', '#comments'
      ];
      removeSelectors.forEach((sel) => {
        clone.querySelectorAll(sel).forEach((el) => el.remove());
      });
    }

    const cleanText = clone ? this.cleanSectionText(clone.innerText) : '';
    const isFinancial = this.isFinancialContent(cleanText, rawTitle, window.location.href);

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

    return {
      isFinanceSite: isFinancial,
      isReportPage: isFinancial,
      siteType: isFinancial ? 'financial_web' : 'generic_web',
      ticker,
      company,
      exchange,
      sector: isFinancial ? 'Financial Analysis' : 'General Webpage',
      formType: isFinancial ? 'Article / Report' : 'General Document',
      filingDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      periodBadge: isFinancial ? `${ticker !== 'PAGE' ? ticker + ' · ' : ''}Financial Article` : 'General Page',
      headlines: [pageHeading],
      fullText: `Topic / Headline: ${pageHeading}\n\nContent:\n${cleanText.slice(0, 18000)}`,
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
