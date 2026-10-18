/* Alpha LogicX Academy — teacher dashboard. Every action is re-authorized by RLS/RPC in the database and /api checks. */
(() => {
const { h, t, rpc, toast, fmt, field, input, card } = AC;
const sb = () => AC.sb;
AC.addStrings({
  search: ['بحث بالاسم أو اسم المستخدم', 'Search name or username'], adjust: ['تعديل النقاط', 'Adjust points'], amount: ['المقدار (± )', 'Amount (±)'], reason: ['السبب', 'Reason'],
  new_assign: ['واجب جديد', 'New assignment'], title: ['العنوان', 'Title'], instr: ['التعليمات', 'Instructions'], kind: ['النوع', 'Type'], late: ['سياسة التأخير', 'Late policy'], allow: ['السماح مع وسم "متأخر"', 'Allow (marked late)'], block: ['منع', 'Block'],
  bonus_p: ['نقاط إضافية', 'Bonus points'], targets: ['الطلاب المستهدفون (فارغ = الجميع)', 'Target students (empty = everyone)'], add_text: ['+ سؤال نصي', '+ Text'], add_mcq: ['+ اختيار متعدد', '+ Multiple choice'], add_file: ['+ سؤال بملفات', '+ File question'],
  prompt: ['نص السؤال', 'Question'], notes: ['ملاحظات', 'Notes'], criteria: ['معايير التقييم (للمعلم و Gemini فقط)', 'Grading criteria (teacher & Gemini only)'], pts: ['الدرجة', 'Points'], multi: ['عدة إجابات صحيحة', 'Multiple correct'],
  choice: ['خيار', 'Choice'], correct: ['صحيح', 'Correct'], add_choice: ['+ خيار', '+ Choice'], publish: ['نشر', 'Publish'], draft: ['مسودة', 'Draft'], published: ['منشور', 'Published'], total_pts: ['المجموع', 'Total'],
  pending: ['بانتظار التقييم', 'Pending'], review: ['مراجعة', 'Review'], analyze: ['تحليل بـ Gemini', 'Analyze with Gemini'], ai_ind: ['فحص مؤشرات الكتابة الآلية (غير حاسم)', 'Check AI-writing indicators (inconclusive)'],
  apply: ['استخدام الدرجة المقترحة', 'Use suggested score'], save_grade: ['حفظ مؤقتاً', 'Save (not final)'], finalize: ['اعتماد الدرجة ومنح النقاط', 'Finalize & award points'], overall_fb: ['ملاحظات عامة', 'Overall feedback'],
  ai_warn: ['⚠️ تحليل Gemini استشاري فقط؛ مؤشرات الكتابة الآلية غير موثوقة ولا تُعدّ دليلاً. القرار النهائي للمعلم.', '⚠️ Gemini analysis is advisory. AI-writing indicators are unreliable and never proof. The final decision is yours.'],
  ai_off: ['Gemini غير مُعدّ على الخادم (GEMINI_API_KEY).', 'Gemini is not configured on the server (GEMINI_API_KEY).'], reasoning: ['التعليل', 'Reasoning'], sugg_fb: ['ملاحظات مقترحة', 'Suggested feedback'], limits: ['حدود وشكوك', 'Limitations'],
  c_new: ['تحدٍّ جديد', 'New challenge'], start: ['البداية', 'Start'], end: ['النهاية', 'End'], base_p: ['نقاط أساسية', 'Base points'], bonus_first: ['مكافأة الأول', 'First bonus'], assignment: ['الواجب', 'Assignment'],
  ann_title: ['عنوان الإعلان', 'Announcement title'], ann_body: ['النص', 'Body'], ann_pin: ['تثبيت في الدردشة', 'Pin in chat'], sent: ['تم الإرسال.', 'Sent.'],
  stat_students: ['الطلاب', 'Students'], stat_pending: ['بانتظار التقييم', 'Pending'], stat_graded: ['مُقيَّمة', 'Graded'], stat_avg: ['متوسط النسبة %', 'Average %'], per_assign: ['التسليمات لكل واجب', 'Submissions per assignment'],
  attachments: ['مرفقات السؤال', 'Question files'], files: ['الملفات', 'Files'], selected: ['الاختيارات', 'Selected'], reports_empty: ['لا تقارير بعد.', 'No reports yet.'], reports_chat: ['بلاغات الدردشة', 'Chat reports'],
});
const pill = (txt, c) => h('span', { class: 'ac-pill ' + (c || '') }, txt);
const act = (fn, ok) => async (e) => { e.target.disabled = true; try { await fn(); if (ok) toast(ok); } catch (er) { toast(AC.errMsg(er), true); } e.target.disabled = false; };
const local = (d) => (d ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '');
const iso = (v) => (v ? new Date(v).toISOString() : null);

// ---------- students ----------
AC.views.students = async () => {
  const { data: ss } = await sb().from('profiles').select('id,username,full_name,display_name,avatar,total_points').eq('role', 'student').order('full_name');
  const { data: subs } = await sb().from('submissions').select('student_id,status');
  const prog = {}; (subs || []).forEach((s) => { (prog[s.student_id] ||= { d: 0, g: 0 }); if (s.status !== 'draft') prog[s.student_id].d++; if (s.status === 'graded') prog[s.student_id].g++; });
  const list = h('div', { class: 'ac-grid' }), q = h('input', { class: 'ac-in', placeholder: t('search'), 'aria-label': t('search'), oninput: draw });
  function draw() {
    const v = q.value.trim().toLowerCase();
    list.replaceChildren(...ss.filter((s) => !v || s.full_name.toLowerCase().includes(v) || String(s.username).toLowerCase().includes(v)).map((s) => {
      const a = input('number', 'amt', { placeholder: t('amount') }), r = input('text', 'why', { placeholder: t('reason') });
      return card(h('div', { class: 'ac-row' }, AC.avatarEl(s.avatar, 48), h('div', {}, h('b', {}, s.full_name), h('div', { class: 'ac-muted' }, '@' + s.username))),
        h('p', {}, `${s.total_points} ${t('points')} · ${t('st_submitted')}: ${prog[s.id]?.d || 0} · ${t('st_graded')}: ${prog[s.id]?.g || 0}`), a, r,
        h('button', { class: 'ac-btn', onclick: act(async () => { await rpc('adjust_points', { stu: s.id, amt: parseInt(a.value, 10), why: r.value }); AC.go('students'); }, t('save') + ' ✓') }, t('adjust')));
    }));
  }
  draw(); return h('div', {}, q, list);
};

// ---------- assignments list + builder ----------
AC.views.assignments = async () => {
  const { data } = await sb().from('assignments').select('*, questions(points)').order('created_at', { ascending: false });
  return h('div', {}, h('button', { class: 'ac-btn pri', onclick: () => AC.go('builder') }, t('new_assign')), h('div', { class: 'ac-grid', style: 'margin-top:12px' }, (data || []).map((a) =>
    card(h('h4', {}, a.title), h('div', { class: 'ac-row' }, pill(a.status === 'published' ? t('published') : t('draft'), a.status === 'published' ? 'ok' : 'warn'), pill(`${t('total_pts')}: ${a.questions.reduce((s, q) => s + Number(q.points), 0)}`)),
      h('p', { class: 'ac-muted' }, `${t('deadline')}: ${fmt(a.deadline)}`), h('div', { class: 'ac-row' }, h('button', { class: 'ac-btn', onclick: () => AC.go('builder', a.id) }, t('edit')),
        a.status === 'draft' ? h('button', { class: 'ac-btn pri', onclick: act(async () => { await rpc('publish_assignment', { aid: a.id }); AC.go('assignments'); }, t('publish') + ' ✓') }, t('publish')) : null,
        h('button', { class: 'ac-btn bad', onclick: act(async () => { if (confirm(t('del') + '?')) { await rpc('delete_assignment', { aid: a.id }); AC.go('assignments'); } }) }, t('del')))))));
};

AC.views.builder = async (id) => {
  let a = { title: '', instructions: '', kind: 'assignment', deadline: null, late_policy: 'allow', bonus_points: 0 }, qs = [], targets = [];
  if (id) {
    a = (await sb().from('assignments').select('*').eq('id', id).single()).data;
    const { data } = await sb().from('questions').select('*, choices(*)').eq('assignment_id', id).order('position'); qs = data.map((q) => ({ ...q, choices: q.choices.sort((x, y) => x.position - y.position) }));
    targets = (await sb().from('assignment_targets').select('student_id').eq('assignment_id', id)).data.map((x) => x.student_id);
  }
  const students = (await sb().from('profiles').select('id,full_name,username').eq('role', 'student').order('full_name')).data || [];
  const ti = input('text', 't', { value: a.title, maxlength: 160 }), ins = h('textarea', { class: 'ac-in' }, a.instructions), kind = h('select', { class: 'ac-in' }, ['assignment', 'quiz'].map((k) => h('option', { value: k, selected: a.kind === k }, k)));
  const dl = input('datetime-local', 'd', { value: local(a.deadline) }), lp = h('select', { class: 'ac-in' }, ['allow', 'block'].map((k) => h('option', { value: k, selected: a.late_policy === k }, t(k)))), bn = input('number', 'b', { value: a.bonus_points, min: 0 });
  const tg = h('select', { class: 'ac-in', multiple: true, size: 5 }, students.map((s) => h('option', { value: s.id, selected: targets.includes(s.id) }, `${s.full_name} (@${s.username})`)));
  const qbox = h('div', {}), total = h('b', {});
  const sum = () => (total.textContent = `${t('total_pts')}: ${qs.reduce((s, q) => s + (Number(q.points) || 0), 0)}`);
  const drawQ = () => { qbox.replaceChildren(...qs.map((q, i) => {
    const el = card(h('div', { class: 'ac-row' }, pill(`${t('q')} ${i + 1} · ${q.type}`), h('button', { class: 'ac-btn bad', onclick: () => { qs.splice(i, 1); drawQ(); } }, t('del'))),
      field(t('prompt'), h('textarea', { class: 'ac-in', oninput: (e) => (q.prompt = e.target.value) }, q.prompt || '')), field(t('notes'), h('input', { class: 'ac-in', value: q.notes || '', oninput: (e) => (q.notes = e.target.value) })),
      field(t('pts'), h('input', { class: 'ac-in', type: 'number', min: 0, step: '0.5', value: q.points, oninput: (e) => { q.points = e.target.value; sum(); } })));
    if (q.type !== 'mcq') el.append(field(t('criteria'), h('textarea', { class: 'ac-in', oninput: (e) => (q.grading_criteria = e.target.value) }, q.grading_criteria || '')));
    if (q.type === 'mcq') { q.choices ||= []; el.append(h('label', { class: 'ac-opt' }, h('input', { type: 'checkbox', checked: q.multiple, onchange: (e) => (q.multiple = e.target.checked) }), t('multi')),
      ...q.choices.map((c, j) => h('div', { class: 'ac-row' }, h('input', { class: 'ac-in', style: 'flex:1;margin:0', placeholder: t('choice') + ' ' + (j + 1), value: c.label, oninput: (e) => (c.label = e.target.value) }),
        h('label', { class: 'ac-opt' }, h('input', { type: q.multiple ? 'checkbox' : 'radio', name: 'c' + i, checked: c.is_correct, onchange: (e) => { if (!q.multiple) q.choices.forEach((x) => (x.is_correct = false)); c.is_correct = e.target.checked; } }), t('correct')),
        h('button', { class: 'ac-btn bad', onclick: () => { q.choices.splice(j, 1); drawQ(); } }, '×'))), h('button', { class: 'ac-btn', onclick: () => { q.choices.push({ label: '', is_correct: false }); drawQ(); } }, t('add_choice'))); }
    // teacher attachments (private bucket "assignment-files")
    q.attachments ||= []; const fl = h('div', { class: 'ac-row' }, q.attachments.map((f) => AC.fileLink('assignment-files', f)));
    el.append(field(t('attachments'), h('input', { type: 'file', class: 'ac-in', accept: '.png,.jpg,.jpeg,.webp,.pdf,.txt', onchange: async (e) => { try { q.attachments.push(await AC.upload('assignment-files', e.target.files[0])); drawQ(); } catch { toast(t('bad_file'), true); } } })), fl);
    return el; })); sum(); };
  const addQ = (type) => { qs.push({ type, prompt: '', points: 1, multiple: false, choices: type === 'mcq' ? [{ label: '', is_correct: false }, { label: '', is_correct: false }] : undefined, attachments: [] }); drawQ(); };
  drawQ();
  const payload = () => ({ id: id || null, title: ti.value.trim(), instructions: ins.value, kind: kind.value, deadline: iso(dl.value), late_policy: lp.value, bonus_points: parseInt(bn.value || '0', 10), targets: [...tg.selectedOptions].map((o) => o.value),
    questions: qs.map((q) => ({ type: q.type, prompt: q.prompt, notes: q.notes, grading_criteria: q.grading_criteria, points: Number(q.points), multiple: !!q.multiple, attachments: q.attachments || [], choices: q.type === 'mcq' ? q.choices : undefined })) });
  const saveNow = async () => { const p = payload(); if (p.title.length < 2 || p.questions.some((q) => !q.prompt.trim() || !(q.points >= 0))) throw new Error('invalid'); return rpc('save_assignment', { payload: p }); };
  return h('div', {}, field(t('title'), ti), field(t('instr'), ins), h('div', { class: 'ac-grid' }, field(t('kind'), kind), field(t('deadline'), dl), field(t('late'), lp), field(t('bonus_p'), bn)), field(t('targets'), tg), qbox,
    h('div', { class: 'ac-row' }, h('button', { class: 'ac-btn', onclick: () => addQ('text') }, t('add_text')), h('button', { class: 'ac-btn', onclick: () => addQ('mcq') }, t('add_mcq')), h('button', { class: 'ac-btn', onclick: () => addQ('file') }, t('add_file')), total),
    h('div', { class: 'ac-row', style: 'margin-top:12px' }, h('button', { class: 'ac-btn pri', onclick: act(async () => { await saveNow(); AC.go('assignments'); }, t('save') + ' ✓') }, t('save')),
      h('button', { class: 'ac-btn pri', onclick: act(async () => { const aid = await saveNow(); await rpc('publish_assignment', { aid }); AC.go('assignments'); }, t('publish') + ' ✓') }, t('save') + ' + ' + t('publish')), h('button', { class: 'ac-btn', onclick: () => AC.go('assignments') }, t('cancel'))));
};

// ---------- submissions + grading ----------
AC.views.submissions = async () => {
  const { data } = await sb().from('submissions').select('id,status,submitted_at,is_late,total_score,student_id,assignment:assignments(title)').neq('status', 'draft').order('submitted_at', { ascending: false }).limit(100);
  const ids = [...new Set((data || []).map((s) => s.student_id))], names = {};
  if (ids.length) ((await sb().from('public_profiles').select('id,display_name').in('id', ids)).data || []).forEach((p) => (names[p.id] = p.display_name));
  return h('div', {}, ...(data?.length ? data.map((s) => card(h('div', { class: 'ac-row' }, h('b', {}, s.assignment.title), pill(names[s.student_id] || '—'), pill(s.status === 'graded' ? `${t('st_graded')} ${s.total_score}` : t('pending'), s.status === 'graded' ? 'ok' : 'warn'), s.is_late ? pill(t('overdue'), 'bad') : null),
    h('small', { class: 'ac-muted' }, fmt(s.submitted_at)), h('div', {}, h('button', { class: 'ac-btn pri', onclick: () => AC.go('review', s.id) }, t('review'))))) : [h('p', { class: 'ac-muted' }, t('empty'))]));
};

AC.views.review = async (sid) => {
  const { data: s } = await sb().from('submissions').select('*, assignment:assignments(title)').eq('id', sid).single();
  const { data: answers } = await sb().from('answers').select('*, q:questions(*, choices(*))').eq('submission_id', sid);
  const { data: reps } = await sb().from('ai_reports').select('*').eq('submission_id', sid).order('created_at', { ascending: false });
  const inputs = {}; const root = h('div', {}, h('button', { class: 'ac-btn', onclick: () => AC.go('submissions') }, t('back')), h('h3', {}, s.assignment.title), h('p', { class: 'ac-pill warn' }, t('ai_warn')));
  answers.sort((a, b) => a.q.position - b.q.position).forEach((a) => {
    const sc = h('input', { class: 'ac-in', type: 'number', min: 0, max: a.q.points, step: '0.5', value: a.score ?? '', 'aria-label': t('score') }), fb = h('input', { class: 'ac-in', value: a.feedback || '', placeholder: t('feedback') }); inputs[a.id] = { sc, fb };
    const out = h('div', {}), c = card(h('b', {}, a.q.prompt), h('div', { class: 'ac-muted' }, `${t('pts')}: ${a.q.points}`));
    if (a.q.type === 'mcq') c.append(h('p', {}, `${t('selected')}: ` + a.q.choices.filter((x) => a.selected_choice_ids.includes(x.id)).map((x) => (x.is_correct ? '✓ ' : '✗ ') + x.label).join(' | ')));
    else c.append(h('p', { style: 'white-space:pre-wrap' }, a.text_answer || '—'), a.files?.length ? h('div', { class: 'ac-row' }, h('small', {}, t('files')), a.files.map((f) => AC.fileLink('submissions', f))) : null);
    c.append(h('div', { class: 'ac-row' }, sc, fb));
    if (a.q.type !== 'mcq') {
      const ai = h('input', { type: 'checkbox' }), render = (r) => { out.replaceChildren(card(h('p', {}, `${t('score')}: ${r.suggested_score} / ${r.max_score}`), h('b', {}, t('reasoning')), h('p', {}, r.reasoning), h('b', {}, t('sugg_fb')), h('p', {}, r.suggested_feedback || ''),
        r.ai_indicators?.requested ? h('p', {}, `AI indicators (${r.ai_indicators.confidence}): ${(r.ai_indicators.observations || []).join('; ')}`) : null, h('b', {}, t('limits')), h('ul', {}, (r.limitations || []).map((l) => h('li', {}, l))),
        h('button', { class: 'ac-btn', onclick: () => { sc.value = r.suggested_score; fb.value = r.suggested_feedback || fb.value; } }, t('apply')))); };
      const last = reps.find((r) => r.report.answer_id === a.id); if (last) render(last.report);
      c.append(h('div', { class: 'ac-row' }, h('label', { class: 'ac-opt' }, ai, t('ai_ind')), h('button', { class: 'ac-btn', onclick: act(async () => { try { const { report } = await AC.api('/api/ai/analyze', { answerId: a.id, includeAi: ai.checked }); render({ ...report, max_score: Number(a.q.points) }); } catch (e) { out.replaceChildren(h('p', { class: 'ac-pill bad' }, e.status === 503 ? t('ai_off') : e.status === 429 ? t('err_many') : t('err_generic'))); } }) }, '✨ ' + t('analyze'))), out);
    }
    root.append(c);
  });
  const overall = h('textarea', { class: 'ac-in' }, s.feedback || '');
  const submit = (fin) => act(async () => { await rpc('grade_submission', { sid, scores: answers.filter((a) => inputs[a.id].sc.value !== '').map((a) => ({ answer_id: a.id, score: Number(inputs[a.id].sc.value), feedback: inputs[a.id].fb.value })), fb: overall.value, finalize: fin }); AC.go('submissions'); }, '✓');
  root.append(field(t('overall_fb'), overall), h('div', { class: 'ac-row' }, h('button', { class: 'ac-btn', onclick: submit(false) }, t('save_grade')), h('button', { class: 'ac-btn pri', onclick: submit(true) }, t('finalize'))));
  return root;
};

// ---------- challenges ----------
AC.views.tchallenges = async () => {
  const [{ data: cs }, { data: as }] = await Promise.all([sb().from('challenges').select('*, a:assignments(title)').order('created_at', { ascending: false }), sb().from('assignments').select('id,title').eq('status', 'published')]);
  const f = h('form', {}, field(t('title'), input('text', 't', { required: true })), field(t('instr'), h('textarea', { class: 'ac-in', name: 'd' })), field(t('assignment'), h('select', { class: 'ac-in', name: 'a', required: true }, (as || []).map((a) => h('option', { value: a.id }, a.title)))),
    h('div', { class: 'ac-grid' }, field(t('start'), input('datetime-local', 's', { required: true })), field(t('end'), input('datetime-local', 'e', { required: true })), field(t('base_p'), input('number', 'bp', { value: 10, min: 0 })), field(t('bonus_first'), input('number', 'bf', { value: 5, min: 0 }))),
    h('button', { class: 'ac-btn pri', type: 'submit' }, t('c_new')));
  f.addEventListener('submit', act(async () => { const { error } = await sb().from('challenges').insert({ title: f.t.value.trim(), description: f.d.value, assignment_id: f.a.value, starts_at: iso(f.s.value), ends_at: iso(f.e.value), base_points: +f.bp.value, bonus_points: +f.bf.value, created_by: AC.state.profile.id }); if (error) throw error; AC.go('tchallenges'); }, t('save') + ' ✓'));
  f.addEventListener('submit', (e) => e.preventDefault());
  return h('div', {}, card(f), ...(cs || []).map((c) => card(h('b', {}, c.title), h('div', { class: 'ac-muted' }, `${c.a.title} · ${fmt(c.starts_at)} → ${fmt(c.ends_at)} · ${c.base_points}+${c.bonus_points}`), c.winner_id ? pill('🏆', 'ok') : null,
    h('button', { class: 'ac-btn bad', onclick: act(async () => { if (confirm(t('del') + '?')) { await sb().from('challenges').delete().eq('id', c.id); AC.go('tchallenges'); } }) }, t('del')))));
};

// ---------- announcements ----------
AC.views.announce = () => {
  const f = h('form', {}, field(t('ann_title'), input('text', 't', { required: true, maxlength: 120 })), field(t('ann_body'), h('textarea', { class: 'ac-in', name: 'b', required: true })), h('label', { class: 'ac-opt' }, h('input', { type: 'checkbox', name: 'p' }), t('ann_pin')), h('button', { class: 'ac-btn pri', type: 'submit' }, t('send')));
  f.addEventListener('submit', (e) => { e.preventDefault(); act(async () => { await rpc('send_announcement', { t: f.t.value.trim(), b: f.b.value.trim(), pin: f.p.checked }); f.reset(); }, t('sent'))({ target: f.querySelector('button') }); });
  return card(f);
};

// ---------- statistics ----------
AC.views.stats = async () => {
  const s = await rpc('teacher_stats'), max = Math.max(1, ...s.per_assignment.map((r) => r.submitted)), kpi = (l, v) => card(h('div', { class: 'ac-muted' }, l), h('h2', {}, String(v ?? '—')));
  const rows = s.per_assignment.map((r, i) => `<text x="0" y="${i * 34 + 14}" fill="#c7c9ee" font-size="12">${String(r.title).replace(/[<>&"]/g, '').slice(0, 22)}</text><rect x="150" y="${i * 34 + 2}" width="${(r.submitted / max) * 300}" height="14" rx="4" fill="#7c3aed"/><rect x="150" y="${i * 34 + 2}" width="${(r.graded / max) * 300}" height="14" rx="4" fill="#22d3ee"/><text x="${156 + (r.submitted / max) * 300}" y="${i * 34 + 14}" fill="#fff" font-size="12">${+r.submitted}/${+r.graded}</text>`).join('');
  const chart = h('div'); chart.innerHTML = `<svg viewBox="0 0 520 ${Math.max(40, s.per_assignment.length * 34)}" width="100%" role="img" aria-label="chart" direction="ltr">${rows}</svg>`;   // text sanitized above; numbers coerced
  return h('div', {}, h('div', { class: 'ac-grid' }, kpi(t('stat_students'), s.students), kpi(t('stat_pending'), s.pending), kpi(t('stat_graded'), s.graded), kpi(t('stat_avg'), s.avg_pct)), card(h('b', {}, t('per_assign')), chart));
};

// ---------- Gemini reports + chat reports ----------
AC.views.reports = async () => {
  const [{ data: reps }, { data: crs }] = await Promise.all([sb().from('ai_reports').select('*').order('created_at', { ascending: false }).limit(30),
    sb().from('message_reports').select('created_at, reason, m:messages(id,body,sender_id,deleted_at)').order('created_at', { ascending: false }).limit(30)]);
  return h('div', {}, h('p', { class: 'ac-pill warn' }, t('ai_warn')), h('h4', {}, t('t_reports')),
    ...(reps?.length ? reps.map((r) => card(h('small', { class: 'ac-muted' }, `${fmt(r.created_at)} · ${r.model}`), h('p', {}, `${t('score')}: ${r.report.suggested_score}/${r.report.max_score}`), h('p', {}, r.report.reasoning), h('button', { class: 'ac-btn', onclick: () => AC.go('review', r.submission_id) }, t('review')))) : [h('p', { class: 'ac-muted' }, t('reports_empty'))]),
    h('h4', {}, t('reports_chat')), ...(crs || []).map((c) => card(h('p', {}, c.m?.body || '(attachment)'), c.m && !c.m.deleted_at ? h('button', { class: 'ac-btn bad', onclick: act(async () => { await rpc('delete_message', { mid: c.m.id }); AC.go('reports'); }) }, t('del')) : pill('✓', 'ok'))));
};
})();
