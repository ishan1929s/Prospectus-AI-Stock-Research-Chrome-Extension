const sample = `{ "overview": "This **Web Document** financial report details **BYD Co.**'s interim performance for **first-half sales**, highlighting that **overseas revenue** surpassed domestic figures for the first time due to intense price competition in the **Chinese automotive market**.", "meter": { "title": "International Expansion vs Domestic Slump", "score": 68, "label": "Export-Led Recovery", vulnerable: "Vulnerable", "leftLabel": "Domestic Decline", "centerLabel": "Transitioning", "rightLabel": "Global Expansion", "explanation": "First-half overseas sales rose **34%** to **181.3 billion yuan ($27 billion)**, accounting for **53%** of total revenue, which offset a **31%** decline in Greater China and propelled Q2 net income up **30%** to **8.2 billion yuan**." }, "toneTag": "Tone: objective operational review", "bullets": [ "**Revenue & Geographic Mix:** First-half international sales surged **34%** year-over-year to **181.3 billion yuan** (**$27 billion**), representing **53%** of total revenue. Meanwhile, Greater China sales contracted **31%** amid a prolonged **10-month** industry downturn.", "**Profitability & Margins:** Second-quarter net income climbed **30%** to **8.2 billion yuan**, outperforming analyst expectations and ending a **five-quarter** profit slump. Higher margins are driven by premium export pricing, such as the **Seal U plug-in hybrid SUV** selling in Germany for **39,900 euros ($46,200)**—more than double its Beijing sticker price.", "**Domestic Market Pressures:** Total passenger vehicle sales in China fell **21%** in **July**, according to data from the **China Passenger Car Association**. Persistent price cuts by domestic rivals such as **Xiaomi Corp.** and **Xpeng Inc.** have severely compressed domestic retail revenues.", "**International Trade Barriers:** Global expansion faces escalating regulatory hurdles, including effective market closure in the **US**, potential **EU tariffs** on hybrid and electric vehicles, and import restrictions implemented by **Brazil** and **Mexico**.", "**Operational & Production Headwinds:** **BYD** is localizing manufacturing via overseas factories, including a flagship facility under construction in **Hungary**. However, production has been delayed to the **fourth quarter** (roughly **one year** behind schedule) due to subcontractor labor scrutiny and a government probe into state subsidies." ], "suggestedQueries": [ "What specific regulatory adjustments or subsidy terms are under investigation at BYD's flagship manufacturing facility in Hungary?", "How do the segment-level gross margins for BYD's overseas vehicle exports compare against domestic sales in the latest interim report?", "What are the detailed shipment volumes and localized assembly timelines for BYD's newly launched Racco EV model in Japan?" ], "disclaimer": "Objective analytical breakdown of page disclosures and reported information. Does not constitute financial advice or investment recommendations." }`;

function safeParseJSON(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.substring(firstBrace, lastBrace + 1);
  }

  // 1. Standard JSON parse
  try {
    return JSON.parse(clean);
  } catch (e1) {}

  // 2. JS Object literal parser (handles unquoted keys like vulnerable: "...", trailing commas, single quotes)
  try {
    const fn = new Function('return (' + clean + ')');
    const result = fn();
    if (result && typeof result === 'object') return result;
  } catch (e2) {}

  // 3. Regex repair for unquoted keys and trailing commas
  try {
    let repaired = clean
      .replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":')
      .replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(repaired);
  } catch (e3) {}

  return null;
}

const res = safeParseJSON(sample);
console.log('Parsed successfully:', !!res);
console.log('Overview:', res?.overview);
console.log('Meter title:', res?.meter?.title);
console.log('Bullets count:', res?.bullets?.length);
console.log('Queries count:', res?.suggestedQueries?.length);
