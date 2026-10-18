'use strict';
// Builds a privacy-minimising prompt (no names, emails, usernames) and parses Gemini's JSON.
const SYSTEM = `You are an assistant helping a teacher review ONE student answer.
Return ONLY JSON: {"understanding":string,"correctness":string,"relevance":string,"completeness":string,
"suggested_score":number,"max_score":number,"reasoning":string,"suggested_feedback":string,
"ai_indicators":{"requested":boolean,"observations":string[],"confidence":"low"|"medium"|"high"|"not_assessed"},
"limitations":string[]}
Rules: the teacher makes the final decision. Writing-style indicators of AI-generated text are uncertain and
are NEVER proof; do not accuse the student; do not recommend penalties. State uncertainty honestly.
If ai_indicators.requested is false set confidence to "not_assessed" and observations to [].`;

function buildPrompt({ question, criteria, maxScore, answerText, includeAi }) {
  return `QUESTION:\n${question}\n\nTEACHER GRADING CRITERIA:\n${criteria || '(none provided)'}\n\nMAX SCORE: ${maxScore}\n\nSTUDENT ANSWER:\n${answerText || '(empty)'}\n\nAI-writing indicators requested: ${includeAi ? 'true' : 'false'}`;
}

function parseReport(raw, maxScore) {
  let t = String(raw || '').replace(/```json|```/g, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('invalid_ai_response');
  const r = JSON.parse(t.slice(a, b + 1));
  if (typeof r.suggested_score !== 'number' || typeof r.reasoning !== 'string') throw new Error('invalid_ai_response');
  r.max_score = maxScore;
  r.suggested_score = Math.min(Math.max(r.suggested_score, 0), maxScore);
  r.limitations = Array.isArray(r.limitations) ? r.limitations : [];
  r.limitations.push('AI suggestions are advisory only and must be reviewed by the teacher.');
  return r;
}

async function callGemini({ key, model, prompt, signal }) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  });
  if (res.status === 429) { const e = new Error('rate_limited'); e.status = 429; throw e; }
  if (!res.ok) { const e = new Error('upstream_error'); e.status = 502; throw e; }
  const j = await res.json();
  return j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
}
module.exports = { buildPrompt, parseReport, callGemini };
