const fs = require('fs');

// Mock browser environment for extractors.js
global.window = {
  location: {
    href: 'https://finance.yahoo.com/quote/AAPL/',
    hostname: 'finance.yahoo.com',
    pathname: '/quote/AAPL/',
    search: '',
  }
};
global.document = {
  title: 'Apple Inc. (AAPL) Stock Price, News, Quote & History - Yahoo Finance',
  contentType: 'text/html',
  body: { innerText: 'Apple Inc. AAPL revenue iPhone Mac iPad Services' },
  querySelector: (sel) => {
    // If querying header, return null or a header without "Yahoo"
    if (sel.includes('quote-hdr')) {
      return { innerText: 'Apple Inc. (AAPL)' };
    }
    return null;
  },
  querySelectorAll: () => []
};

const { FinancialExtractors } = require('../content/extractors.js');

const result = FinancialExtractors.extractPageData();
console.log('Extracted result:', {
  siteType: result.siteType,
  ticker: result.ticker,
  company: result.company,
});

if (result.company === 'Apple Inc.' && result.ticker === 'AAPL') {
  console.log('✓ PASS: Yahoo Finance extracted correctly as Apple Inc. (AAPL)');
} else {
  console.error('✗ FAIL: Expected Apple Inc., got:', result.company);
  process.exit(1);
}

// Test 2: If DOM header accidentally had "Yahoo Finance"
global.document.querySelector = (sel) => {
  if (sel.includes('h1')) return { innerText: 'Yahoo Finance' };
  return null;
};
const result2 = FinancialExtractors.extractPageData();
console.log('Extracted result 2 (with Yahoo Finance in header):', {
  siteType: result2.siteType,
  ticker: result2.ticker,
  company: result2.company,
});

if (result2.company === 'Apple Inc.' && result2.ticker === 'AAPL') {
  console.log('✓ PASS: Platform name in header discarded, resolved Apple Inc. from title!');
} else {
  console.error('✗ FAIL: Expected Apple Inc., got:', result2.company);
  process.exit(1);
}
