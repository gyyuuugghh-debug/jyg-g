'use strict';
require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const { isUsername, isEmail } = require('./lib/validate');
const { buildPrompt, parseReport, callGemini } = require('./lib/gemini');

const env = process.env;
const missing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !env[k]);
if (missing.length) { console.error('Missing env: ' + missing.join(', ') + ' (see .env.example)'); process.exit(1); }

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, opts);   // server only
const anon = () => createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, opts);
const MODEL = env.GEMINI_MODEL || 'gemini-flash-latest';
const PUBLIC_URL = env.PUBLIC_URL || `http://localhost:${env.PORT || 3000}`;

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));   // legacy site uses inline scripts; tighten after refactor
app.use(express.json({ limit: '1mb' }));

const limiter = (windowMs, max) => rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { error: 'too_many_requests' } });

// ---------- Auth helpers ----------
async function authUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: p } = await admin.from('profiles').select('id, role, must_change_password').eq('id', data.user.id).single();
  return p ? { ...p, verified: !!data.user.email_confirmed_at } : null;
}
const requireUser = async (req, res, next) => {
  const u = await authUser(req);
  if (!u) return res.status(401).json({ error: 'unauthenticated' });
  req.user = u; next();
};
const requireTeacher = (req, res, next) =>
  req.user.role === 'teacher' && !req.user.must_change_password ? next() : res.status(403).json({ error: 'forbidden' });

// ---------- Public config (anon key is public by design) ----------
app.get('/api/config', (_q, res) => res.json({
  supabaseUrl: env.SUPABASE_URL, supabaseAnonKey: env.SUPABASE_ANON_KEY, aiConfigured: !!env.GEMINI_API_KEY,
}));

// ---------- Login by username OR email (no account enumeration) ----------
app.post('/api/login', limiter(15 * 60 * 1000, 20), async (req, res) => {
  const { identifier, password } = req.body || {};
  if (typeof identifier !== 'string' || typeof password !== 'string' || identifier.length > 254) return res.status(400).json({ error: 'invalid_credentials' });
  let email = identifier.trim();
  if (isUsername(email)) {
    const { data } = await admin.from('profiles').select('id').eq('username', email).maybeSingle();
    if (data) { const u = await admin.auth.admin.getUserById(data.id); email = u.data?.user?.email || ''; }
    else email = '';
  }
  const { data, error } = email ? await anon().auth.signInWithPassword({ email, password }) : { error: true };
  if (error || !data?.session) return res.status(401).json({ error: 'invalid_credentials' });
  res.json({ session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
});

// ---------- Forgot password / resend verification (generic responses, rate-limited) ----------
const generic = { ok: true, message: 'If an account exists for this email, a message will be sent.' };
app.post('/api/forgot-password', limiter(60 * 60 * 1000, 5), async (req, res) => {
  const email = req.body?.email;
  if (isEmail(email)) await anon().auth.resetPasswordForEmail(email, { redirectTo: `${PUBLIC_URL}/?academy=reset` }).catch(() => {});
  res.json(generic);
});
app.post('/api/resend-verification', limiter(60 * 60 * 1000, 5), async (req, res) => {
  const email = req.body?.email;
  if (isEmail(email)) await anon().auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${PUBLIC_URL}/?academy=verified` } }).catch(() => {});
  res.json(generic);
});

// ---------- Gemini: teacher-reviewed analysis ----------
app.post('/api/ai/analyze', limiter(60 * 1000, 10), requireUser, requireTeacher, async (req, res) => {
  const key = env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'ai_not_configured', message: 'GEMINI_API_KEY is not set on the server.' });
  const { answerId, includeAi } = req.body || {};
  if (typeof answerId !== 'string') return res.status(400).json({ error: 'invalid_request' });
  const { data: a } = await admin.from('answers').select('id, submission_id, text_answer, question:questions(prompt, grading_criteria, points, type)').eq('id', answerId).single();
  if (!a || a.question.type === 'mcq') return res.status(404).json({ error: 'not_found' });
  try {
    const ctrl = AbortSignal.timeout(30000);
    const raw = await callGemini({ key, model: MODEL, signal: ctrl, prompt: buildPrompt({
      question: a.question.prompt, criteria: a.question.grading_criteria, maxScore: Number(a.question.points),
      answerText: a.text_answer, includeAi: !!includeAi }) });
    const report = parseReport(raw, Number(a.question.points));
    await admin.from('ai_reports').insert({ submission_id: a.submission_id, requested_by: req.user.id, model: MODEL, include_ai_indicators: !!includeAi, report: { answer_id: a.id, ...report } });
    await admin.from('audit_log').insert({ actor_id: req.user.id, action: 'ai_analysis', target_type: 'answer', target_id: a.id });
    res.json({ report });
  } catch (e) {
    const code = e.status || 502;
    res.status(code).json({ error: e.message === 'rate_limited' ? 'rate_limited' : 'ai_unavailable', message: 'Gemini request failed. Try again later.' });
  }
});

// ---------- Gemini proxy for the existing browser assistant (key stays server-side) ----------
app.all('/api/gemini/*', limiter(60 * 1000, 30), requireUser, async (req, res) => {
  if (!env.GEMINI_API_KEY) return res.status(503).json({ error: { message: 'GEMINI_API_KEY is not configured on the server.' } });
  const sub = req.params[0];
  if (!/^[A-Za-z0-9._:-]*$/.test(sub)) return res.status(400).end();
  try {
    const q = req.method === 'GET' ? '?pageSize=100' : '';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models${sub ? '/' + sub : ''}${q}`, {
      method: req.method === 'GET' ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: req.method === 'GET' ? undefined : JSON.stringify(req.body), signal: AbortSignal.timeout(60000) });
    res.status(r.status).type('json').send(await r.text());
  } catch { res.status(502).json({ error: { message: 'upstream_error' } }); }
});

// ---------- Static site ----------
app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'index.html' }));

// ---------- Deadline reminders every 30 min ----------
setInterval(() => admin.rpc('notify_deadlines').then(({ error }) => error && console.error('deadline job:', error.message)), 30 * 60 * 1000);

if (require.main === module) app.listen(env.PORT || 3000, () => console.log(`Academy running on ${PUBLIC_URL}`));
module.exports = app;
