# Chrome Web Store Listing & Compliance

## Extension Metadata
- **Title**: Prospectus — Stock & SEC Research Copilot
- **Subtitle**: Organize and summarize SEC filings and financial research with BYOK AI.
- **Category**: Productivity / Financial Research
- **Pricing**: Paid License ($29–$49 one-time purchase with license key activation)
- **Primary Language**: English

---

## Store Listing Description

### Short Description (Max 132 chars)
Organize, summarize, and diff SEC filings and stock research without buy/sell signals. Uses your own AI key for unlimited privacy.

### Long Description
**Prospectus** is a fast, objective research copilot for stock investors and analysts that automatically organizes, explains, and diffs complex financial documents.

Unlike automated trading bots or prediction tools, Prospectus does **not** provide buy/sell signals, target prices, or speculative advice. Instead, it extracts the exact facts and language shifts you need from SEC filings, earnings transcripts, and financial news—saving hours of multi-tab reading.

### Key Features

1. **Filing Summary & 30-Day Coverage Tone Meter**:
   - Plain-English executive summaries of 10-K, 10-Q, and 8-K filings.
   - Descriptive 30-day coverage tone meter (Negative → Neutral → Positive) reporting factual media sentiment without market predictions.

2. **What Changed (Filing Diff Redline Engine)**:
   - Compares current Item 1A Risk Factors and MD&A against prior periods with sentence-level redline additions and deletions.
   - Highlights added supply chain vulnerabilities, regulatory disclosures, or altered capex guidance.

3. **In-Context Explain Terms**:
   - Highlight any financial term (e.g. *deferred revenue*, *gross margin*) to get an explanation grounded in the actual numbers on that page.

4. **Research Notebook & Auto Cross-Referencing**:
   - Save quotes and notes per ticker.
   - Automatically cross-references related disclosures across multiple quarters (*"Also flagged in Q1 & Q2 filings"*).
   - Export your research to Markdown or JSON anytime.

5. **Daily Watchlist Digest**:
   - One quiet, neutral summary line per tracked ticker per day.

6. **Zero-Server Privacy & BYOK (Bring Your Own Key)**:
   - Uses your own API key (OpenAI, Anthropic Claude, Google Gemini, or OpenRouter).
   - Your API keys, notes, and research data never touch external servers—everything runs 100% locally in your browser.

---

## Permissions Justification

| Permission | Technical Reason & User Benefit |
|---|---|
| `storage` | Stores user settings, BYOK API keys, research notes, and local filing snapshots locally on the user's machine. |
| `activeTab` | Injects the research sidebar panel on non-finance pages when the user clicks the extension action or keyboard shortcut. |
| `contextMenus` | Adds right-click actions ("Explain term with Prospectus", "Save to Prospectus Notebook") on highlighted text. |
| `alarms` | Triggers the optional daily background refresh for the user's local Watchlist digest. |
| `scripting` | Programmatically injects the research panel UI when requested by the user on general web pages. |
| `sidePanel` | Displays the research copilot in Chrome's native side panel alongside native PDF documents and reports. |
| `notifications` | Notifies the user when their automated daily watchlist digest has identified new SEC filings or material updates. |
| `tabs` | Accesses active tab URLs and titles to detect financial tickers and page context. |

### Host Permissions Justifications

| Host Permission | Justification |
|---|---|
| `<all_urls>` | Enables users to summon the research panel, explain complex financial jargon, and organize notes across arbitrary corporate investor relations sites, press releases, and global financial portals. |
| `https://api.openai.com/*` | Connects directly to OpenAI endpoints using the user's BYOK key. |
| `https://api.anthropic.com/*` | Connects directly to Anthropic Claude endpoints using the user's BYOK key. |
| `https://generativelanguage.googleapis.com/*` | Connects directly to Google Gemini endpoints using the user's BYOK key. |
| `https://openrouter.ai/*` | Connects directly to OpenRouter endpoints using the user's BYOK key. |
| `https://query1.finance.yahoo.com/*` | Fetches real-time price quotes, intraday day ranges, and currency metadata for tracked stocks. |
| `https://query2.finance.yahoo.com/*` | Secondary failover host for real-time market data quotes and ticker search. |

---

## Privacy Policy Summary
- **Data Collection**: No personal data, browsing history, or financial queries are collected or transmitted to our servers.
- **Storage**: All user notes, API keys, and filing baselines reside strictly in `chrome.storage.local`.
- **Third-Party AI**: AI calls are made directly from the user's client to their selected provider (OpenAI, Anthropic, Google, or OpenRouter) using their private API key.
