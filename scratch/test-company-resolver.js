// Mock chrome and window
global.chrome = {
  storage: {
    local: {
      get: async () => ({}),
      set: async () => {}
    }
  }
};
global.window = {};

const { WatchlistService, POPULAR_COMPANIES } = require('../services/watchlist-service.js');

class MockStorage {
  constructor(initial = []) { this.list = initial; }
  async getWatchlist() { return [...this.list]; }
  async saveWatchlist(l) { this.list = [...l]; }
}

async function runTests() {
  let passed = 0;
  let failed = 0;
  function assert(cond, msg) {
    if (cond) { console.log('✓ PASS:', msg); passed++; }
    else { console.error('✗ FAIL:', msg); failed++; }
  }

  const mockStorage = new MockStorage([
    { ticker: 'NVDA', company: 'Yahoo Finance', lastDigest: { summary: 'Tracking **Yahoo Finance**' } }
  ]);
  const ws = new WatchlistService(mockStorage, null);

  // 1. isPlatformOrGenericName
  assert(ws.isPlatformOrGenericName('Yahoo Finance') === true, 'isPlatformOrGenericName detects Yahoo Finance');
  assert(ws.isPlatformOrGenericName('yahoo') === true, 'isPlatformOrGenericName detects yahoo');
  assert(ws.isPlatformOrGenericName('Google Finance') === true, 'isPlatformOrGenericName detects Google Finance');
  assert(ws.isPlatformOrGenericName('MarketWatch') === true, 'isPlatformOrGenericName detects MarketWatch');
  assert(ws.isPlatformOrGenericName('Apple Inc.') === false, 'isPlatformOrGenericName allows Apple Inc.');
  assert(ws.isPlatformOrGenericName('NVIDIA Corporation') === false, 'isPlatformOrGenericName allows NVIDIA Corporation');

  // 2. cleanCompanyName
  assert(ws.cleanCompanyName('Apple Inc. (AAPL) Stock Price - Yahoo Finance', 'AAPL') === 'Apple Inc.', 'cleanCompanyName cleans raw title');
  assert(ws.cleanCompanyName('NVIDIA Corporation (NVDA)', 'NVDA') === 'NVIDIA Corporation', 'cleanCompanyName removes ticker bracket');

  // 3. resolveCompanyName
  assert(ws.resolveCompanyName('AAPL', 'Yahoo Finance') === 'Apple Inc.', 'resolveCompanyName AAPL with Yahoo Finance returns Apple Inc.');
  assert(ws.resolveCompanyName('NVDA', 'Yahoo Finance') === 'NVIDIA Corporation', 'resolveCompanyName NVDA with Yahoo Finance returns NVIDIA Corporation');
  assert(ws.resolveCompanyName('TSLA', 'Yahoo') === 'Tesla, Inc.', 'resolveCompanyName TSLA with Yahoo returns Tesla, Inc.');
  assert(ws.resolveCompanyName('MSFT', '') === 'Microsoft Corporation', 'resolveCompanyName MSFT with empty returns Microsoft Corporation');
  assert(ws.resolveCompanyName('PLTR', 'Yahoo Finance') === 'Palantir Technologies Inc.', 'resolveCompanyName PLTR with Yahoo Finance returns Palantir Technologies Inc.');

  // 4. addTicker with 'Yahoo Finance' as company
  await ws.addTicker('AAPL', 'Yahoo Finance');
  const list = await ws.getWatchlist();
  const aaplItem = list.find(i => i.ticker === 'AAPL');
  assert(aaplItem && aaplItem.company === 'Apple Inc.', 'addTicker saves AAPL as Apple Inc., NOT Yahoo Finance');

  // 5. Auto-healing of pre-existing 'Yahoo Finance' entry
  const nvdaItem = list.find(i => i.ticker === 'NVDA');
  assert(nvdaItem && nvdaItem.company === 'NVIDIA Corporation', 'getWatchlist auto-heals corrupted NVDA entry from Yahoo Finance to NVIDIA Corporation');

  console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

runTests();
