const fs = require('fs');

// Mock browser environment
global.chrome = {
  storage: {
    local: {
      get: async () => ({}),
      set: async () => {}
    }
  }
};
global.window = {};

const { WatchlistService } = require('../services/watchlist-service.js');

async function runTests() {
  let passed = 0;
  let failed = 0;
  function assert(cond, msg) {
    if (cond) { console.log('✓ PASS:', msg); passed++; }
    else { console.error('✗ FAIL:', msg); failed++; }
  }

  const ws = new WatchlistService();

  // Test 1: getTickerNews fetches live articles with exact URLs
  console.log('Testing live news fetching for AAPL and NVDA...');
  const aaplNews = await ws.getTickerNews('AAPL');
  assert(Array.isArray(aaplNews) && aaplNews.length > 0, 'getTickerNews returns array of news articles for AAPL');
  if (aaplNews.length > 0) {
    const first = aaplNews[0];
    assert(first.title && typeof first.title === 'string', 'News article has title: ' + first.title);
    assert(first.url && first.url.startsWith('https://') && !first.url.endsWith('/quote/AAPL'), 'News article has exact source URL: ' + first.url);
  }

  // Test 2: getTickerTrackerDetail incorporates live news with exact URLs
  const nvdaDetail = await ws.getTickerTrackerDetail('NVDA');
  assert(nvdaDetail && Array.isArray(nvdaDetail.news) && nvdaDetail.news.length > 0, 'getTickerTrackerDetail returns news for NVDA');
  const allNvdaUrlsExact = nvdaDetail.news.every(n => n.url && n.url.startsWith('https://') && !n.url.endsWith('/quote/NVDA'));
  assert(allNvdaUrlsExact, 'All NVDA news items have exact source URLs');

  // Test 3: Notebook section in content.js has NO track option
  const contentJs = fs.readFileSync('./content/content.js', 'utf8');
  assert(!contentJs.includes('btn-track-note-ticker'), 'content.js no longer contains btn-track-note-ticker');
  assert(!contentJs.includes('+ Track ${entry.ticker}'), 'content.js no longer contains + Track ${entry.ticker}');

  // Test 4: Notebook section in sidepanel.js has NO track option
  const sidepanelJs = fs.readFileSync('./sidepanel/sidepanel.js', 'utf8');
  assert(!sidepanelJs.includes('btn-sp-track-ticker'), 'sidepanel.js no longer contains btn-sp-track-ticker');
  assert(!sidepanelJs.includes('+ Track ${n.ticker}'), 'sidepanel.js no longer contains + Track ${n.ticker}');

  // Test 5: News items in both content.js and sidepanel.js have click listeners and open exact page
  assert(contentJs.includes('// News Item Click Handler'), 'content.js has dedicated News Item Click Handler');
  assert(sidepanelJs.includes('// News Item Click Handler'), 'sidepanel.js has dedicated News Item Click Handler');

  console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

runTests();
