/**
 * File: gemini.js
 * Author: Swathi Pallikala
 * Project: PhishLens
 * Description:
 *   Robust Gemini wrapper that uses the REST API directly.
 *   - Auto-discovers a supported model for your API key via v1/models
 *   - Falls back across a preferred list if discovery is limited
 *   - Uses generateContent with JSON prompt
 *
 *   Requires: process.env.GEMINI_API_KEY
 */

const API_ROOT = 'https://generativelanguage.googleapis.com/v1';
const PREFERRED = [
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash-latest',
  'gemini-1.0-pro',
  'gemini-pro'
];

let chosenModel = null;

async function listModels(key) {
  const url = `${API_ROOT}/models?key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`listModels failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return (data.models || []).map(m => m.name.replace('models/', ''));
}

async function pickModel(key) {
  if (chosenModel) return chosenModel;

  // Try discovery first
  try {
    const available = await listModels(key);
    console.log('[gemini] available models for this key:', available);
    for (const name of PREFERRED) {
      if (available.includes(name)) {
        chosenModel = name;
        console.log('[gemini] using model:', chosenModel);
        return chosenModel;
      }
    }
    // fallback: take the first available “gemini-*” model if any
    const anyGemini = available.find(n => /^gemini-/.test(n));
    if (anyGemini) {
      chosenModel = anyGemini;
      console.log('[gemini] using first available model:', chosenModel);
      return chosenModel;
    }
  } catch (e) {
    console.warn('[gemini] discovery failed (will try fallbacks):', e.message);
  }

  // Last resort: try preferred list until one works (probe with trivial prompt)
  for (const name of PREFERRED) {
    const ok = await probeModel(key, name).catch(() => false);
    if (ok) {
      chosenModel = name;
      console.log('[gemini] using probed model:', chosenModel);
      return chosenModel;
    }
  }

  throw Object.assign(
    new Error('No supported Gemini model found for this API key. Ensure "Generative Language API" is enabled and your key is valid.'),
    { status: 502 }
  );
}

async function probeModel(key, model) {
  const url = `${API_ROOT}/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] })
  });
  return res.ok;
}

/**
 * Analyze Vision output using Gemini reasoning.
 * @param {Object} vision - {facesCount, faces[], latencyMs}
 * @returns {Promise<{risk:number, reason:string, recommendedAction:string, latencyMs:number, model:string}>}
 */
export async function analyzeGemini(vision) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Object.assign(new Error('GEMINI_API_KEY missing'), { status: 500 });

  const model = await pickModel(key);

  const url = `${API_ROOT}/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const start = Date.now();

  const prompt = `
You are an AI risk assessor for digital image authenticity.
Given the Google Vision output below, estimate manipulation risk.

Return strictly:
- risk: number 0–100
- reasoning: one short paragraph
- recommendedAction: one of "ignore", "review", "flag"

Vision output:
${JSON.stringify(vision, null, 2)}
  `;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw Object.assign(new Error(`Gemini error ${res.status} ${res.statusText}: ${errBody}`), { status: 502 });
  }

  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

  const riskMatch = text.match(/(\d{1,3})/);
  const risk = riskMatch ? Math.min(parseInt(riskMatch[1], 10), 100) : 50;

  let recommendedAction = 'review';
  if (/\bignore\b/i.test(text)) recommendedAction = 'ignore';
  else if (/\bflag\b/i.test(text)) recommendedAction = 'flag';

  return {
    risk,
    reason: text,
    recommendedAction,
    latencyMs: Date.now() - start,
    model
  };
}
