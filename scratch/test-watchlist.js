const https = require('https');
const zlib = require('zlib');

function fetchCompanyTickers() {
  return new Promise((resolve) => {
    const url = 'https://www.sec.gov/files/company_tickers.json';
    const options = {
      headers: {
        'User-Agent': 'ProspectusFinancial ResearchApp/1.0 (contact@prospectus-research.com)',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    };
    https.get(url, options, (res) => {
      let stream = res;
      if (res.headers['content-encoding'] === 'gzip') stream = res.pipe(zlib.createGunzip());
      let data = '';
      stream.on('data', c => data += c);
      stream.on('end', () => {
        try {
          const json = JSON.parse(data);
          const entries = Object.values(json);
          const nvda = entries.find(e => e.ticker === 'NVDA');
          const tsla = entries.find(e => e.ticker === 'TSLA');
          resolve({ count: entries.length, nvda, tsla });
        } catch (err) {
          resolve({ error: err.message });
        }
      });
    });
  });
}

(async () => {
  const res = await fetchCompanyTickers();
  console.log('Company Tickers Result:', res);
})();
