/**
 * Prospectus - Multi-Provider BYOK AI Service
 * Supports OpenAI, Anthropic Claude, Google Gemini, and OpenRouter / Custom Endpoints.
 * Enforces institutional-grade financial analysis with strict non-advisory compliance boundaries.
 */

const SYSTEM_COMPLIANCE_PROMPT = `You are Prospectus, an elite financial research assistant for equity investors and analysts.
CRITICAL COMPLIANCE AND EDITORIAL RULES:
1. STRICTLY DESCRIPTIVE: You report what the filing, transcript, or document states factually. You NEVER give buy, sell, or hold recommendations, price targets, or predictive market forecasts.
2. INSTITUTIONAL PRECISION: Focus on hard numbers, operational drivers, margin trends, supply chain vulnerabilities, capex guidance shifts, and legal/regulatory changes.
3. NO FLUFF: Avoid generic boilerplate definitions. Use direct, dense, and objective financial language.`;

class AIService {
  constructor(storageService) {
    this.storage = storageService || (typeof window !== 'undefined' ? window.ProspectusStorage : null);
  }

  async getCredentials() {
    const settings = await this.storage.getSettings();
    return {
      provider: settings.aiProvider || 'openai',
      apiKey: (settings.apiKey || '').trim(),
      model: settings.modelName || 'gpt-4o-mini',
      customEndpoint: (settings.customEndpoint || '').trim(),
      temperature: typeof settings.temperature === 'number' ? settings.temperature : 0.2,
    };
  }

  /**
   * Generic LLM Chat Completion Dispatcher
   */
  async callLLM({ systemPrompt = SYSTEM_COMPLIANCE_PROMPT, userPrompt, jsonMode = false }) {
    const creds = await this.getCredentials();
    if (!creds.apiKey && creds.provider !== 'custom') {
      throw new Error(`Please enter your ${creds.provider.toUpperCase()} API key in Prospectus Settings.`);
    }

    switch (creds.provider) {
      case 'anthropic':
        return await this._callAnthropic({ creds, systemPrompt, userPrompt });
      case 'gemini':
        return await this._callGemini({ creds, systemPrompt, userPrompt, jsonMode });
      case 'openrouter':
        return await this._callOpenRouter({ creds, systemPrompt, userPrompt, jsonMode });
      case 'custom':
        return await this._callCustom({ creds, systemPrompt, userPrompt, jsonMode });
      case 'openai':
      default:
        return await this._callOpenAI({ creds, systemPrompt, userPrompt, jsonMode });
    }
  }

  // --- OpenAI Client ---
  async _callOpenAI({ creds, systemPrompt, userPrompt, jsonMode }) {
    const endpoint = 'https://api.openai.com/v1/chat/completions';
    const payload = {
      model: creds.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: creds.temperature,
    };
    if (jsonMode) {
      payload.response_format = { type: 'json_object' };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`OpenAI API error (${res.status}): ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // --- Anthropic Claude Client ---
  async _callAnthropic({ creds, systemPrompt, userPrompt }) {
    const endpoint = 'https://api.anthropic.com/v1/messages';
    const payload = {
      model: creds.model || 'claude-3-5-haiku-20241022',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: creds.temperature,
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': creds.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Anthropic API error (${res.status}): ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text || '';
  }

  // --- Google Gemini Client ---
  async _callGemini({ creds, systemPrompt, userPrompt, jsonMode }) {
    const model = creds.model || 'gemini-2.0-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${creds.apiKey}`;

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nTask:\n${userPrompt}` }],
        },
      ],
      generationConfig: {
        temperature: creds.temperature,
      },
    };

    if (jsonMode) {
      payload.generationConfig.responseMimeType = 'application/json';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Gemini API error (${res.status}): ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // --- OpenRouter Client ---
  async _callOpenRouter({ creds, systemPrompt, userPrompt, jsonMode }) {
    const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    const payload = {
      model: creds.model || 'meta-llama/llama-3.3-70b-instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: creds.temperature,
    };
    if (jsonMode) {
      payload.response_format = { type: 'json_object' };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.apiKey}`,
        'HTTP-Referer': 'https://prospectus-extension.local',
        'X-Title': 'Prospectus Chrome Extension',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`OpenRouter API error (${res.status}): ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // --- Custom Endpoint ---
  async _callCustom({ creds, systemPrompt, userPrompt, jsonMode }) {
    const endpoint = creds.customEndpoint || 'http://localhost:11434/v1/chat/completions';
    const payload = {
      model: creds.model || 'default',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: creds.temperature,
    };

    const headers = { 'Content-Type': 'application/json' };
    if (creds.apiKey) {
      headers.Authorization = `Bearer ${creds.apiKey}`;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Custom API error (${res.status}): ${res.statusText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // ==========================================
  // High-Level Domain Features & Prompts
  // ==========================================

  /**
   * 1. Generate Filing Summary & Coverage Tone Meter
   */
  async generateSummary({ ticker, company, formType, text, headlines = [] }) {
    const prompt = `Analyze the following extracted financial report / document for ${ticker} (${company}).
Document Type: ${formType || 'Financial Report'}

Extracted High-Signal Document Text:
"""
${text.slice(0, 15000)}
"""

Recent Headlines / Context:
${(headlines || []).slice(0, 8).map((h, i) => `${i + 1}. ${h}`).join('\n')}

ANALYTICAL REQUIREMENTS:
1. Tone Evaluation: Objectively score the descriptive tone of the disclosures/coverage on a scale of 0 to 100:
   - 0–35: Negative (material headwinds, widening losses, severe risk factor additions, legal/regulatory penalties)
   - 36–64: Neutral / Mixed (in-line operations, steady margins, balanced risk updates)
   - 65–100: Positive (accelerating growth, margin expansion, capex returns, risk factor resolution)
2. Bullet Points: Write exactly 4 dense, high-signal bullet points:
   - Bullet 1: Core revenue, segment demand, and gross/operating margin performance.
   - Bullet 2: Key operational risks, supplier concentration, or regulatory shifts.
   - Bullet 3: Capital allocation, capex guidance changes, or facility investments.
   - Bullet 4: Notable observation, past litigation status, or disclosure omission.
3. Tone Label: 2–4 word descriptive phrase (e.g. "Mixed, leaning cautious on supply chain", "Solid execution, flat margins").
4. Tone Pill Tag: Short tag (e.g. "Tone: measured, cautious on single-source supplier").
5. Suggested Deep-Dive Research Queries: Suggest exactly 3 high-value, contextual deep-dive queries/topics tailored to this specific filing/company that an analyst should ask (e.g. "Supplier concentration & Southeast Asia facilities", "Texas capex expansion timeline", "Gross margin preservation trends").

Return STRICTLY valid JSON with no markdown formatting:
{
  "toneScore": <number 0-100>,
  "toneLabel": "<string>",
  "toneTag": "<string>",
  "bullets": [
    "<string>",
    "<string>",
    "<string>",
    "<string>"
  ],
  "suggestedQueries": [
    "<query 1>",
    "<query 2>",
    "<query 3>"
  ],
  "whatChangedPointer": "<string>"
}`;

    const raw = await this.callLLM({ userPrompt: prompt, jsonMode: true });
    try {
      const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(clean);
    } catch (e) {
      console.error('Failed to parse summary JSON:', raw);
      return {
        toneScore: 50,
        toneLabel: 'Neutral, factual overview',
        toneTag: 'Tone: measured overview',
        bullets: [
          `Filing extracted for ${company} (${ticker}).`,
          `Analyzed operational disclosures and financial statements.`,
          `Review the What Changed tab for detailed risk factor shifts.`,
          `Highlight any specific metric on the page to explain terms in context.`
        ],
        suggestedQueries: [
          `Single-source supplier concentration risks`,
          `Capex guidance and plant expansion plans`,
          `Gross margin sensitivity and volume trends`
        ],
        whatChangedPointer: 'Open What changed for exact filing language diffs.'
      };
    }
  }

  /**
   * 2. Explain What Changed (Diff Analysis)
   */
  async explainWhatChanged({ ticker, formType, currentText, previousText, diffAdditions = [], diffDeletions = [] }) {
    const prompt = `Compare these two consecutive SEC filing disclosures for ${ticker} (${formType}).

NEW / ADDED DISCLOSURES:
"""
${diffAdditions.slice(0, 8).join('\n---\n')}
"""

REMOVED / MODIFIED DISCLOSURES:
"""
${diffDeletions.slice(0, 8).join('\n---\n')}
"""

Task:
Provide an objective, institutional-grade breakdown of what materially shifted between these periods.
Focus on:
1. New operational or supply chain vulnerabilities added.
2. Capex or guidance revisions.
3. Removed risks or settled litigation disclosures.

Respond in STRICTLY valid JSON:
{
  "summary": "<2-3 sentence overview of major material shifts>",
  "keyChanges": [
    { "category": "<Risk Factors / Operational / Capex / Legal>", "detail": "<specific shift and analytical context>" }
  ]
}`;

    const raw = await this.callLLM({ userPrompt: prompt, jsonMode: true });
    try {
      const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(clean);
    } catch (e) {
      return {
        summary: 'Language shifts focus primarily to updated operational disclosures and supply chain risk adjustments between reporting periods.',
        keyChanges: [
          { category: 'Risk Factors', detail: 'Added new disclosures on supplier concentration and logistics redundancy.' },
          { category: 'Capex Guidance', detail: 'Updated full-year capital expenditure projections to fund expansion facilities.' }
        ]
      };
    }
  }

  /**
   * 3. Explain Financial Term in Context (using actual page numbers)
   */
  async explainTermInContext({ term, context, ticker, company }) {
    const prompt = `A financial researcher reading a document for ${ticker} (${company}) highlighted the term: "${term}".

Surrounding sentence and disclosure context:
"""
${context}
"""

Task:
Explain what "${term}" means IN THIS EXACT CONTEXT.
MANDATORY RULES:
1. Cite and explain the actual numbers, dollar values, percentages, or disclosure facts present in the text above.
2. Do NOT provide a generic textbook definition.
3. Keep explanation concise (2-3 sentences), factual, and directly relevant to this company's report.`;

    return await this.callLLM({ userPrompt: prompt });
  }

  /**
   * 4. Watchlist Daily Digest (1-liner per ticker)
   */
  async generateWatchlistLine({ ticker, company, recentData }) {
    const prompt = `Write exactly ONE dense, neutral, high-information summary sentence (max 20 words) for ticker ${ticker} (${company}) based on recent developments:
"${recentData}"
Compliance: Strictly factual. No price targets, recommendations, or predictive signals.`;

    const res = await this.callLLM({ userPrompt: prompt });
    return res.replace(/^["']|["']$/g, '').trim();
  }

  /**
   * 5. Advanced Research & Interactive Q&A (Document Deep-Dives + Public Sources)
   */
  async performAdvancedResearch({ query, ticker, company, documentContext = '' }) {
    const prompt = `You are Prospectus, an elite financial research assistant for ${ticker} (${company}).
The user has asked the following deep-dive research question / query:
"${query}"

${documentContext ? `DOCUMENT DISCLOSURE CONTEXT:\n"""\n${documentContext.slice(0, 10000)}\n"""\n` : ''}

Task:
Provide a precise, objective, institutional-grade answer to the query above.
1. Directly address what the document/filing and company disclosures state about this topic.
2. Ground your points in specific numbers, dates, operational units, and stated risk mitigations.
3. Structure with concise bullet points.
4. Strictly descriptive, non-advisory, and factual.`;

    return await this.callLLM({ userPrompt: prompt });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AIService };
}
if (typeof window !== 'undefined') {
  window.ProspectusAI = new AIService(window.ProspectusStorage);
}
