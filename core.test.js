'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { isUsername, isEmail, isPassword, checkFile } = require('../server/lib/validate');
const { buildPrompt, parseReport } = require('../server/lib/gemini');

test('username rules', () => {
  assert.ok(isUsername('yaser_1'));
  for (const bad of ['ab', 'has space', 'a'.repeat(25), '', null, 'x;drop']) assert.ok(!isUsername(bad));
});
test('email rules', () => {
  assert.ok(isEmail('student@gmail.com'));
  for (const bad of ['a@b', 'no-at.com', '', 'a b@c.com']) assert.ok(!isEmail(bad));
});
test('password rules', () => {
  assert.ok(isPassword('abcd1234'));
  for (const bad of ['short1', 'allletters', '12345678']) assert.ok(!isPassword(bad));
});
test('file validation enforces type and size', () => {
  assert.strictEqual(checkFile('chat', { type: 'image/png', size: 1000 }), null);
  assert.strictEqual(checkFile('chat', { type: 'application/x-msdownload', size: 1000 }), 'type_not_allowed');
  assert.strictEqual(checkFile('chat', { type: 'image/png', size: 6 * 1024 * 1024 }), 'file_too_large');
  assert.strictEqual(checkFile('nope', { type: 'image/png', size: 1 }), 'unknown_bucket');
});
test('gemini prompt contains no personal data fields', () => {
  const p = buildPrompt({ question: 'Q', criteria: 'C', maxScore: 5, answerText: 'A', includeAi: false });
  assert.ok(!/email|username|full_name/i.test(p));
  assert.match(p, /AI-writing indicators requested: false/);
});
test('gemini report parsing clamps score and appends limitation', () => {
  const r = parseReport('```json\n{"suggested_score":99,"reasoning":"ok"}\n```', 5);
  assert.strictEqual(r.suggested_score, 5);
  assert.ok(r.limitations.some((l) => /teacher/i.test(l)));
  assert.throws(() => parseReport('not json', 5));
  assert.throws(() => parseReport('{"reasoning":"x"}', 5));
});
