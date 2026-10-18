/* Alpha LogicX Academy — student + shared views (chat, leaderboard). */
(() => {
const { h, t, rpc, toast, fmt } = AC;
const sb = () => AC.sb;
const me = () => AC.state.profile;
AC.addStrings({
  filter_all: ['الكل', 'All'], no_deadline: ['بدون موعد', 'No deadline'], open: ['فتح', 'Open'], q: ['سؤال', 'Question'],
  mcq_multi: ['اختر كل الإجابات الصحيحة', 'Select all correct answers'], mcq_single: ['اختر إجابة واحدة', 'Select one answer'], your_answer: ['إجابتك', 'Your answer'],
  teacher_files: ['مرفقات المعلم', 'Teacher attachments'], back: ['رجوع', 'Back'], late_note: ['⚠️ تسليمك سيُعدّ متأخراً.', '⚠️ Your submission will count as late.'],
  read_only: ['تم التسليم — لا يمكن التعديل.', 'Submitted — editing is locked.'], waiting: ['بانتظار تقييم المعلم', 'Awaiting teacher grading'],
  remaining: ['المتبقي', 'Remaining'], base: ['نقاط أساسية', 'Base points'], bonus: ['مكافأة أول تسليم', 'First-submission bonus'], rule: ['القاعدة: أول تسليم صالح (غير فارغ) خلال المدة يربح المكافأة.', 'Rule: the first valid (non-empty) submission within the window wins the bonus.'],
  active: ['جارٍ', 'Active'], upcoming: ['قادم', 'Upcoming'], ended: ['انتهى', 'Ended'], winner: ['الفائز', 'Winner'], none_yet: ['لا فائز بعد', 'No winner yet'],
  weekly: ['أسبوعي', 'Weekly'], alltime: ['كل الأوقات', 'All-time'], completed: ['مكتملة', 'Completed'], won: ['تحديات فائزة', 'Challenges won'], bonus_pts: ['نقاط المكافآت', 'Bonus points'],
  say: ['اكتب رسالة…', 'Type a message…'], sending: ['جارٍ الإرسال…', 'Sending…'], failed: ['فشل الإرسال', 'Failed to send'], report: ['إبلاغ', 'Report'], pin: ['تثبيت', 'Pin'], unpin: ['إلغاء التثبيت', 'Unpin'],
  reported: ['تم الإبلاغ.', 'Reported.'], mark_all: ['تعليم الكل كمقروء', 'Mark all read'], history: ['سجل النقاط', 'Points history'], achievements: ['الإنجازات', 'Achievements'], to_next: ['للمستوى التالي', 'to next level'],
  ach_first: ['🎯 أول واجب مُقيَّم', '🎯 First graded assignment'], ach_five: ['📚 5 واجبات مكتملة', '📚 5 completed assignments'], ach_win: ['🏆 فائز بتحدٍّ', '🏆 Challenge winner'], ach_100: ['⭐ 100 نقطة', '⭐ 100 points'],
  edit_avatar: ['تعديل الشخصية', 'Edit avatar'], total: ['المجموع', 'Total'], download: ['تنزيل', 'Download'],
});
const pill = (txt, cls) => h('span', { class: 'ac-pill ' + (cls || '') }, txt);
const guard = () => (me().verified ? null : AC.card(h('p', {}, t('verify_needed'))));

// signed download links (private buckets)
AC.fileLink = (bucket, f) => h('a', { href: '#', class: 'ac-pill', onclick: async (e) => { e.preventDefault(); const { data, error } = await sb().storage.from(bucket).createSignedUrl(f.path, 60, { download: f.name }); if (error) return toast(t('err_generic'), true); window.open(data.signedUrl, '_blank', 'noopener'); } }, '📎 ' + f.name);
AC.checkFile = (bucket, file) => {
  const L = { submissions: [10, ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']], chat: [5, ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain']], 'assignment-files': [10, ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain']] }[bucket];
  return L[1].includes(file.type) && file.size > 0 && file.size <= L[0] * 1048576;
};
AC.upload = async (bucket, file) => {
  if (!AC.checkFile(bucket, file)) throw new Error(t('bad_file'));
  const path = `${me().id}/${Date.now()}_${file.name.replace(/[^\w.\-]+/g, '_').slice(-60)}`;
  const { error } = await sb().storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false }); if (error) throw error;
  return { path, name: file.name, mime: file.type, size: file.size };
};

// ---------- assignment list ----------
AC.views.home = async () => {
  const g = guard(); if (g) return g;
  const [{ data: as }, { data: subs }] = await Promise.all([sb().from('assignments').select('id,title,deadline,kind').eq('status', 'published').order('created_at', { ascending: false }),
    sb().from('submissions').select('*').eq('student_id', me().id)]);
  const by = Object.fromEntries((subs || []).map((s) => [s.assignment_id, s]));
  const stateOf = (a) => { const s = by[a.id]; return !s ? 'new' : s.status === 'draft' ? 'progress' : s.status; };
  let f = 'all'; const list = h('div', { class: 'ac-grid' }), tabs = h('div', { class: 'ac-tabs' });
  const draw = () => {
    tabs.replaceChildren(...[['all', 'filter_all'], ['new', 'st_new'], ['progress', 'st_progress'], ['submitted', 'st_submitted'], ['graded', 'st_graded']].map(([k, l]) => h('button', { class: 'ac-btn' + (f === k ? ' pri' : ''), onclick: () => { f = k; draw(); } }, t(l))));
    const rows = (as || []).filter((a) => f === 'all' || stateOf(a) === f);
    list.replaceChildren(...(rows.length ? rows.map((a) => { const s = by[a.id], st = stateOf(a), od = a.deadline && new Date(a.deadline) < new Date() && (st === 'new' || st === 'progress');
      return AC.card(h('h4', {}, a.title), h('div', { class: 'ac-row' }, pill(t('st_' + st), st === 'graded' ? 'ok' : st === 'submitted' ? '' : 'warn'), od ? pill(t('overdue'), 'bad') : null, a.kind === 'quiz' ? pill('Quiz') : null),
        h('p', { class: 'ac-muted' }, t('deadline') + ': ' + (a.deadline ? fmt(a.deadline) : t('no_deadline'))), s?.status === 'graded' ? h('p', {}, `${t('score')}: ${s.total_score}`) : null,
        h('button', { class: 'ac-btn pri', onclick: () => AC.go('assignment', a.id) }, t('open'))); }) : [h('p', { class: 'ac-muted' }, t('empty'))]));
  };
  draw(); const pts = h('p', { class: 'ac-muted' }, `${t('level')} ${AC.state.profile.level ?? ''} · ${me().total_points} ${t('points')}`);
  return h('div', {}, pts, tabs, list);
};

// ---------- answering ----------
AC.views.assignment = async (id) => {
  const g = guard(); if (g) return g;
  const a = await rpc('get_assignment', { aid: id });
  const { data: sub } = await sb().from('submissions').select('*').eq('assignment_id', id).eq('student_id', me().id).maybeSingle();
  const { data: saved } = sub ? await sb().from('answers').select('*').eq('submission_id', sub.id) : { data: [] };
  const ans = Object.fromEntries((saved || []).map((x) => [x.question_id, x]));
  const locked = sub && sub.status !== 'draft', graded = sub?.status === 'graded';
  const state = {}; a.questions.forEach((q) => (state[q.id] = { question_id: q.id, text_answer: ans[q.id]?.text_answer || '', selected_choice_ids: ans[q.id]?.selected_choice_ids || [], files: ans[q.id]?.files || [] }));
  const msg = h('p', { class: 'ac-muted', role: 'status' });
  const root = h('div', {}, h('button', { class: 'ac-btn', onclick: () => AC.go('home') }, t('back')), h('h2', {}, a.title), h('p', {}, a.instructions),
    h('p', { class: 'ac-muted' }, `${t('deadline')}: ${a.deadline ? fmt(a.deadline) : t('no_deadline')}`),
    a.deadline && new Date(a.deadline) < new Date() && !locked ? h('p', { class: 'ac-pill warn' }, a.late_policy === 'block' ? t('deadline_passed') : t('late_note')) : null,
    locked ? h('p', { class: 'ac-pill' }, graded ? `${t('score')}: ${sub.total_score}` : t('waiting')) : null, graded && sub.feedback ? AC.card(h('b', {}, t('feedback')), h('p', {}, sub.feedback)) : null);
  a.questions.forEach((q, i) => {
    const st = state[q.id], box = AC.card(h('h4', {}, `${t('q')} ${i + 1} · ${q.points} ${t('points')}`), h('p', {}, q.prompt), q.notes ? h('p', { class: 'ac-muted' }, q.notes) : null,
      q.attachments?.length ? h('div', { class: 'ac-row' }, h('small', {}, t('teacher_files')), q.attachments.map((f) => AC.fileLink('assignment-files', f))) : null);
    if (q.type !== 'mcq') box.append(AC.field(t('your_answer'), h('textarea', { class: 'ac-in', disabled: locked, maxlength: 20000, oninput: (e) => { st.text_answer = e.target.value; dirty(); } }, st.text_answer)));
    if (q.type === 'mcq') box.append(h('small', { class: 'ac-muted' }, q.multiple ? t('mcq_multi') : t('mcq_single')), ...q.choices.map((c) => h('label', { class: 'ac-opt' }, h('input', { type: q.multiple ? 'checkbox' : 'radio', name: 'q' + q.id, disabled: locked, checked: st.selected_choice_ids.includes(c.id),
      onchange: (e) => { st.selected_choice_ids = q.multiple ? (e.target.checked ? [...st.selected_choice_ids, c.id] : st.selected_choice_ids.filter((x) => x !== c.id)) : [c.id]; dirty(); } }), c.label)));
    if (q.type === 'file') {
      const fl = h('div', { class: 'ac-row' }), draw = () => fl.replaceChildren(...st.files.map((f) => AC.fileLink('submissions', f)));
      const inp = h('input', { type: 'file', class: 'ac-in', disabled: locked, accept: '.png,.jpg,.jpeg,.webp,.pdf,.txt,.docx', onchange: async (e) => { const file = e.target.files[0]; if (!file) return; msg.textContent = t('uploading');
        try { st.files = [...st.files, await AC.upload('submissions', file)]; draw(); msg.textContent = ''; dirty(); } catch (er) { msg.textContent = ''; toast(AC.errMsg(er) === t('err_generic') ? t('bad_file') : AC.errMsg(er), true); } e.target.value = ''; } });
      draw(); box.append(AC.field(t('attach'), inp), fl);
    }
    const a2 = ans[q.id]; if (graded && a2) box.append(h('p', {}, `${t('score')}: ${a2.score ?? 0} / ${q.points}`), a2.feedback ? h('p', { class: 'ac-muted' }, a2.feedback) : null);
    root.append(box);
  });
  let timer; const save = async (quiet) => { try { await rpc('save_draft', { aid: id, ans: Object.values(state) }); if (!quiet) toast(t('draft_saved')); } catch (e) { if (!quiet) toast(AC.errMsg(e), true); } };
  const dirty = () => { clearTimeout(timer); timer = setTimeout(() => save(true), 4000); };      // autosave to DB
  if (!locked) root.append(h('div', { class: 'ac-row' }, h('button', { class: 'ac-btn', onclick: () => save(false) }, t('save_draft')),
    h('button', { class: 'ac-btn pri', onclick: async () => { if (!confirm(t('confirm_submit'))) return; try { await save(true); await rpc('submit_assignment', { aid: id }); toast(t('submitted_ok')); AC.refreshUnread(); AC.go('assignment', id); } catch (e) { toast(AC.errMsg(e), true); } } }, t('submit'))), msg);
  return root;
};

// ---------- challenges ----------
AC.views.challenges = async () => {
  const [{ data: cs }, { data: ents }] = await Promise.all([sb().from('challenges').select('*, a:assignments(title)').order('ends_at', { ascending: false }), sb().from('challenge_entries').select('challenge_id').eq('student_id', me().id)]);
  const names = {}; const ids = [...new Set((cs || []).map((c) => c.winner_id).filter(Boolean))];
  if (ids.length) (await sb().from('public_profiles').select('id,display_name').in('id', ids)).data.forEach((p) => (names[p.id] = p.display_name));
  const done = new Set((ents || []).map((e) => e.challenge_id)), now = Date.now();
  return h('div', {}, h('p', { class: 'ac-muted' }, t('rule')), h('div', { class: 'ac-grid' }, (cs || []).length ? cs.map((c) => { const s = new Date(c.starts_at) > now ? 'upcoming' : new Date(c.ends_at) < now ? 'ended' : 'active'; const left = Math.max(0, new Date(c.ends_at) - now);
    return AC.card(h('h4', {}, c.title), h('p', {}, c.description), h('div', { class: 'ac-row' }, pill(t(s), s === 'active' ? 'ok' : ''), done.has(c.id) ? pill('✓', 'ok') : null),
      h('p', { class: 'ac-muted' }, `${t('base')}: ${c.base_points} · ${t('bonus')}: ${c.bonus_points}`), s === 'active' ? h('p', {}, `${t('remaining')}: ${Math.floor(left / 36e5)}h ${Math.floor(left / 6e4) % 60}m`) : null,
      h('p', { class: 'ac-muted' }, `${t('winner')}: ${c.winner_id ? '🏆 ' + (names[c.winner_id] || '') : t('none_yet')}`), s === 'active' && !done.has(c.id) ? h('button', { class: 'ac-btn pri', onclick: () => AC.go('assignment', c.assignment_id) }, t('open')) : null); }) : [h('p', { class: 'ac-muted' }, t('empty'))]));
};

// ---------- leaderboard ----------
AC.views.board = async () => {
  let period = 'all'; const list = h('div', {}), tabs = h('div', { class: 'ac-tabs' });
  const draw = async () => {
    tabs.replaceChildren(...[['all', 'alltime'], ['week', 'weekly']].map(([k, l]) => h('button', { class: 'ac-btn' + (period === k ? ' pri' : ''), onclick: () => { period = k; draw(); } }, t(l))));
    const rows = await rpc('leaderboard', { period });
    list.replaceChildren(...(rows.length ? rows.map((r) => h('div', { class: 'ac-lb' + (r.rank <= 3 ? ' r' + r.rank : '') }, h('span', { class: 'rk' }, r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank), AC.avatarEl(r.avatar, 44),
      h('div', { style: 'flex:1' }, h('b', {}, r.display_name), h('div', { class: 'ac-muted' }, `${t('level')} ${r.level} · ${t('completed')} ${r.completed} · ${t('won')} ${r.challenges_won} · ${t('bonus_pts')} ${r.bonus_points}`)), h('b', {}, `${r.points} ${t('points')}`))) : [h('p', { class: 'ac-muted' }, t('empty'))]));
  };
  await draw(); return h('div', {}, tabs, list);
};

// ---------- chat (Supabase Realtime) ----------
let chatChan;
AC.views.chat = async () => {
  const g = guard(); if (g) return g;
  const isT = me().role === 'teacher', box = h('div', { class: 'ac-msgs', 'aria-live': 'polite' }), prof = {};
  const status = h('small', { class: 'ac-muted' });
  const who = async (ids) => { const need = ids.filter((i) => !prof[i]); if (need.length) (await sb().from('public_profiles').select('id,display_name,avatar').in('id', need)).data.forEach((p) => (prof[p.id] = p)); };
  const row = (m) => {
    const p = prof[m.sender_id] || {}, mine = m.sender_id === me().id, el = h('div', { class: 'ac-msg' + (m.pinned ? ' pin' : '') + (mine ? ' me' : ''), 'data-id': m.id }, AC.avatarEl(p.avatar, 36),
      h('div', { class: 'b' }, h('small', { class: 'ac-muted' }, `${p.display_name || ''} · ${fmt(m.created_at)}${m.pinned ? ' 📌' : ''}`), h('div', {}, m.body || ''), m.attachment ? AC.fileLink('chat', m.attachment) : null,
        h('div', { class: 'ac-row' }, mine || isT ? h('button', { class: 'ac-btn bad', onclick: async () => { try { await rpc('delete_message', { mid: m.id }); el.remove(); } catch (e) { toast(AC.errMsg(e), true); } } }, t('del')) : null,
          !mine ? h('button', { class: 'ac-btn', onclick: async () => { const { error } = await sb().from('message_reports').insert({ message_id: m.id, reporter_id: me().id }); toast(error ? t('reported') : t('reported')); } }, t('report')) : null,
          isT ? h('button', { class: 'ac-btn', onclick: async () => { try { await rpc('set_pinned', { mid: m.id, v: !m.pinned }); load(); } catch (e) { toast(AC.errMsg(e), true); } } }, m.pinned ? t('unpin') : t('pin')) : null)));
    return el;
  };
  const add = async (m) => { if (box.querySelector(`[data-id="${m.id}"]`)) return; await who([m.sender_id]); box.append(row(m)); box.scrollTop = box.scrollHeight; };
  const load = async () => { const { data } = await sb().from('messages').select('*').order('created_at', { ascending: false }).limit(80); const ms = (data || []).reverse(); await who([...new Set(ms.map((m) => m.sender_id))]);
    box.replaceChildren(...ms.sort((a, b) => b.pinned - a.pinned || 0).filter((m) => m.pinned).map(row), ...ms.filter((m) => !m.pinned).map(row)); box.scrollTop = box.scrollHeight; };
  await load();
  if (chatChan) sb().removeChannel(chatChan);
  chatChan = sb().channel('academy-chat').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => add(p.new)).subscribe((s) => (status.textContent = s === 'SUBSCRIBED' ? '● live' : ''));
  const poll = setInterval(() => { if (!document.body.contains(box)) clearInterval(poll); else load(); }, 30000);   // fallback for deletions/pins (soft-deleted rows are not broadcast)
  const input = h('input', { class: 'ac-in', placeholder: t('say'), maxlength: 2000, style: 'flex:1;margin:0' });
  const send = async (payload) => { status.textContent = t('sending'); const { error } = await sb().from('messages').insert({ sender_id: me().id, ...payload }); status.textContent = error ? t('failed') : '● live'; if (error) toast(t('failed'), true); return !error; };
  const form = h('form', { class: 'ac-row', onsubmit: async (e) => { e.preventDefault(); const v = input.value.trim(); if (!v) return; if (await send({ body: v })) input.value = ''; } }, input, h('button', { class: 'ac-btn pri', type: 'submit' }, t('send')),
    h('input', { type: 'file', accept: '.png,.jpg,.jpeg,.webp,.pdf,.txt', 'aria-label': t('attach'), onchange: async (e) => { const f = e.target.files[0]; if (!f) return; status.textContent = t('uploading'); try { const att = await AC.upload('chat', f); await send({ attachment: att }); } catch (er) { status.textContent = t('failed'); toast(t('bad_file'), true); } e.target.value = ''; } }));
  return h('div', { class: 'ac-chat' }, box, status, form);
};

// ---------- profile ----------
AC.views.profile = async () => {
  await AC.reloadProfile(); const p = me();
  const [{ data: tx }, { data: done }, { data: won }] = await Promise.all([sb().from('points_transactions').select('*').eq('student_id', p.id).order('created_at', { ascending: false }).limit(30),
    sb().from('submissions').select('id,total_score,graded_at,assignment:assignments(title)').eq('student_id', p.id).eq('status', 'graded').order('graded_at', { ascending: false }),
    sb().from('challenges').select('id').eq('winner_id', p.id)]);
  const lvl = (await sb().from('public_profiles').select('level').eq('id', p.id).single()).data.level, next = 50 * lvl * lvl, prev = 50 * (lvl - 1) * (lvl - 1);
  const ach = [[done.length >= 1, 'ach_first'], [done.length >= 5, 'ach_five'], [won.length >= 1, 'ach_win'], [p.total_points >= 100, 'ach_100']].filter((x) => x[0]);
  return h('div', {}, AC.card(h('div', { class: 'ac-row' }, AC.avatarEl(p.avatar, 96), h('div', { style: 'flex:1;min-width:200px' }, h('h2', {}, p.display_name || p.username), h('p', {}, `${t('level')} ${lvl} · ${p.total_points} ${t('points')}`),
    h('div', { class: 'ac-bar', role: 'progressbar', 'aria-valuenow': p.total_points }, h('i', { style: `width:${Math.min(100, ((p.total_points - prev) / (next - prev)) * 100)}%` })), h('small', { class: 'ac-muted' }, `${Math.max(0, next - p.total_points)} ${t('to_next')}`)),
    h('button', { class: 'ac-btn', onclick: () => document.querySelector('.ac-main').replaceChildren(AC.views.avatarEditor()) }, t('edit_avatar')))),
    AC.card(h('h4', {}, t('achievements')), h('div', { class: 'ac-row' }, ach.length ? ach.map((a) => pill(t(a[1]), 'ok')) : [h('span', { class: 'ac-muted' }, t('empty'))])),
    AC.card(h('h4', {}, `${t('completed')} (${done.length})`), ...done.map((d) => h('div', { class: 'ac-row' }, h('span', {}, d.assignment.title), pill(String(d.total_score), 'ok')))),
    AC.card(h('h4', {}, t('history')), ...(tx.length ? tx.map((x) => h('div', { class: 'ac-row' }, pill((x.amount > 0 ? '+' : '') + x.amount, x.amount > 0 ? 'ok' : 'bad'), h('span', {}, x.reason), h('small', { class: 'ac-muted' }, fmt(x.created_at)))) : [h('span', { class: 'ac-muted' }, t('empty'))])));
};

// ---------- notifications ----------
let notifChan;
AC.views.notifications = async () => {
  const { data } = await sb().from('notifications').select('*').order('created_at', { ascending: false }).limit(60);
  if (!notifChan) notifChan = sb().channel('academy-notif').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me().id}` }, () => AC.refreshUnread()).subscribe();
  return h('div', {}, h('button', { class: 'ac-btn', onclick: async () => { await rpc('mark_read'); AC.refreshUnread(); AC.go('notifications'); } }, t('mark_all')),
    ...(data.length ? data.map((n) => AC.card(h('div', { class: 'ac-row' }, n.read_at ? null : pill('●', 'warn'), h('b', {}, n.title)), h('p', {}, n.body || ''), h('small', { class: 'ac-muted' }, fmt(n.created_at)),
      n.data?.assignment_id ? h('button', { class: 'ac-btn', onclick: async () => { await rpc('mark_read', { nid: n.id }); AC.refreshUnread(); AC.go('assignment', n.data.assignment_id); } }, t('open')) : null)) : [h('p', { class: 'ac-muted' }, t('empty'))]));
};
})();
