/* Alpha LogicX Academy — core (i18n, auth, avatar, shell). Vanilla JS, no innerHTML for user data. */
(() => {
const AC = window.AC = { views: {}, state: { profile: null, user: null, unread: 0 }, cache: {} };

// ---------- helpers ----------
AC.h = (tag, props, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
};
const h = AC.h;
const D = {
  academy: ['🎓 الأكاديمية', '🎓 Academy'], close: ['العودة للموقع', 'Back to site'],
  login: ['تسجيل الدخول', 'Log in'], register: ['إنشاء حساب طالب', 'Student sign-up'], logout: ['خروج', 'Log out'],
  identifier: ['اسم المستخدم أو البريد', 'Username or email'], password: ['كلمة المرور', 'Password'],
  password2: ['تأكيد كلمة المرور', 'Confirm password'], fullname: ['الاسم الكامل', 'Full name'],
  username: ['اسم المستخدم (فريد)', 'Username (unique)'], email: ['البريد الإلكتروني', 'Email'],
  terms: ['أوافق على شروط الاستخدام', 'I accept the terms of use'], forgot: ['نسيت كلمة المرور؟', 'Forgot password?'],
  send: ['إرسال', 'Send'], save: ['حفظ', 'Save'], cancel: ['إلغاء', 'Cancel'], del: ['حذف', 'Delete'], edit: ['تعديل', 'Edit'],
  loading: ['جارٍ التحميل…', 'Loading…'], empty: ['لا يوجد شيء هنا بعد.', 'Nothing here yet.'],
  generic_reset: ['إذا كان هناك حساب بهذا البريد فسيصلك بريد قريباً.', 'If an account exists for this email, a message will be sent.'],
  check_email: ['أرسلنا رابط التحقق إلى بريدك. افتحه لتفعيل الحساب.', 'We sent a verification link to your email. Open it to activate your account.'],
  verify_needed: ['يجب تأكيد بريدك الإلكتروني لاستخدام هذه الميزة.', 'Verify your email to use this feature.'],
  resend: ['إعادة إرسال رسالة التحقق', 'Resend verification email'],
  new_password: ['كلمة المرور الجديدة', 'New password'], set_password: ['تعيين كلمة المرور', 'Set password'],
  must_change: ['يجب تغيير كلمة المرور الأولية قبل المتابعة.', 'You must change the initial password before continuing.'],
  pw_changed: ['تم تغيير كلمة المرور.', 'Password updated.'], reset_title: ['إعادة تعيين كلمة المرور', 'Reset password'],
  err_pw: ['كلمة المرور: 8 أحرف على الأقل وتحتوي حرفاً ورقماً.', 'Password: at least 8 chars with a letter and a digit.'],
  err_pw_match: ['كلمتا المرور غير متطابقتين.', 'Passwords do not match.'], err_user: ['اسم المستخدم: 3–24 حرفاً/رقماً/_', 'Username: 3–24 letters, digits or _'],
  err_taken: ['اسم المستخدم مستخدم مسبقاً.', 'Username already taken.'], err_email: ['بريد غير صالح.', 'Invalid email.'],
  err_terms: ['يجب قبول الشروط.', 'You must accept the terms.'], err_creds: ['بيانات الدخول غير صحيحة.', 'Invalid credentials.'],
  err_many: ['محاولات كثيرة، حاول لاحقاً.', 'Too many requests, try later.'], err_generic: ['حدث خطأ، حاول مجدداً.', 'Something went wrong, try again.'],
  forbidden: ['غير مسموح.', 'Not allowed.'], email_not_verified: ['البريد غير مؤكد.', 'Email not verified.'],
  already_submitted: ['تم التسليم مسبقاً.', 'Already submitted.'], deadline_passed: ['انتهى الموعد النهائي.', 'The deadline has passed.'],
  empty_submission: ['لا يمكن تسليم إجابة فارغة.', 'Cannot submit an empty answer.'], has_submissions: ['لا يمكن تعديل الأسئلة بعد بدء الطلاب.', 'Questions are locked once students have started.'],
  mcq_needs_correct_choice: ['سؤال الاختيار يحتاج إجابة صحيحة واحدة على الأقل.', 'A multiple-choice question needs at least one correct choice.'],
  score_out_of_range: ['الدرجة خارج النطاق المسموح.', 'Score out of range.'], no_questions: ['أضف سؤالاً واحداً على الأقل.', 'Add at least one question.'],
  // student
  s_home: ['واجباتي', 'Assignments'], s_challenges: ['التحديات', 'Challenges'], s_board: ['المتصدرون', 'Leaderboard'],
  s_chat: ['الدردشة', 'Chat'], s_profile: ['ملفي', 'Profile'], s_notif: ['الإشعارات', 'Notifications'],
  st_new: ['جديدة', 'New'], st_progress: ['قيد العمل', 'In progress'], st_submitted: ['مُسلَّمة', 'Submitted'], st_graded: ['مُقيَّمة', 'Graded'],
  deadline: ['الموعد', 'Deadline'], overdue: ['متأخر', 'Overdue'], points: ['نقاط', 'points'], level: ['المستوى', 'Level'],
  save_draft: ['حفظ مسودة', 'Save draft'], submit: ['تسليم الواجب', 'Submit assignment'], confirm_submit: ['هل تريد التسليم النهائي؟ لا يمكن التعديل بعده.', 'Submit for good? You cannot edit afterwards.'],
  draft_saved: ['حُفظت المسودة.', 'Draft saved.'], submitted_ok: ['تم التسليم.', 'Submitted.'], score: ['الدرجة', 'Score'], feedback: ['ملاحظات المعلم', 'Teacher feedback'],
  attach: ['إرفاق ملف', 'Attach file'], uploading: ['جارٍ الرفع…', 'Uploading…'], bad_file: ['نوع الملف أو حجمه غير مسموح.', 'File type or size not allowed.'],
  // avatar
  av_title: ['صمّم شخصيتك', 'Design your avatar'], av_name: ['اسم العرض', 'Display name'], skin: ['البشرة', 'Skin'], hair: ['الشعر', 'Hair'],
  hairc: ['لون الشعر', 'Hair color'], eyes: ['العيون', 'Eyes'], mouth: ['الفم', 'Mouth'], top: ['الملابس', 'Clothing'], topc: ['لون الملابس', 'Clothing color'],
  acc: ['إكسسوار', 'Accessory'], bg: ['الخلفية', 'Background'], none: ['بدون', 'None'],
  // teacher
  t_students: ['الطلاب', 'Students'], t_assign: ['الواجبات', 'Assignments'], t_subs: ['التسليمات', 'Submissions'], t_chal: ['التحديات', 'Challenges'],
  t_announce: ['إعلان', 'Announce'], t_stats: ['إحصاءات', 'Statistics'], t_reports: ['تقارير Gemini', 'Gemini reports'], t_audit: ['سجل التدقيق', 'Audit log'],
};
const L = () => (document.documentElement.lang === 'en' ? 1 : 0);
const t = AC.t = (k) => (D[k] ? D[k][L()] : k);
AC.addStrings = (o) => Object.assign(D, o);

AC.toast = (m, err) => { const e = h('div', { class: 'ac-toast' + (err ? ' err' : ''), role: 'status' }, m); document.body.append(e); setTimeout(() => e.remove(), 3500); };
AC.errMsg = (e) => { const m = String(e?.message || e || ''); for (const k of ['forbidden', 'email_not_verified', 'already_submitted', 'deadline_passed', 'empty_submission', 'has_submissions', 'mcq_needs_correct_choice', 'score_out_of_range', 'no_questions']) if (m.includes(k)) return t(k); return /429|too_many/.test(m) ? t('err_many') : t('err_generic'); };
AC.fmt = (d) => d ? new Date(d).toLocaleString(L() ? 'en-GB' : 'ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
AC.rpc = async (fn, args) => { const { data, error } = await AC.sb.rpc(fn, args || {}); if (error) throw error; return data; };
AC.api = async (path, body, auth = true) => {
  const { data: { session } } = await AC.sb.auth.getSession();
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth && session ? { Authorization: 'Bearer ' + session.access_token } : {}) }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || r.status), { body: j, status: r.status }); return j;
};
AC.field = (label, input) => h('label', { class: 'ac-l' }, label, input);
AC.input = (type, name, extra) => h('input', { class: 'ac-in', type, name, ...(extra || {}) });
AC.card = (...k) => h('div', { class: 'ac-card' }, k);
const PW = (v) => v.length >= 8 && v.length <= 72 && /[A-Za-z]/.test(v) && /\d/.test(v);

// ---------- avatar (original SVG; config validated on render because other users' data is untrusted) ----------
const A = AC.avatarOpts = {
  skin: ['#f6d5b8', '#e8b98f', '#c68a5c', '#8d5a3b', '#5b3a29'],
  hair: ['short', 'long', 'curly', 'bun', 'bald'], hairColor: ['#2b1b12', '#6b4226', '#d4a017', '#c2410c', '#111827', '#9ca3af', '#7c3aed'],
  eyes: ['round', 'happy', 'wide', 'sleepy'], mouth: ['smile', 'grin', 'flat', 'open'],
  top: ['tee', 'hoodie', 'suit'], topColor: ['#22d3ee', '#7c3aed', '#f43f8e', '#34d399', '#f59e0b', '#1f2937'],
  acc: ['none', 'glasses', 'cap', 'headphones'], bg: ['#1e1b4b', '#134e4a', '#4c1d95', '#7c2d12', '#164e63'],
};
const pick = (list, v, d = 0) => (list.includes(v) ? v : list[d]);
AC.defaultAvatar = () => ({ skin: A.skin[0], hair: 'short', hairColor: A.hairColor[0], eyes: 'round', mouth: 'smile', top: 'tee', topColor: A.topColor[0], acc: 'none', bg: A.bg[0] });
AC.avatarEl = (cfg, size = 64) => {
  const c = cfg && typeof cfg === 'object' ? cfg : AC.defaultAvatar();
  const skin = pick(A.skin, c.skin), hc = pick(A.hairColor, c.hairColor), tc = pick(A.topColor, c.topColor), bg = pick(A.bg, c.bg);
  const hair = pick(A.hair, c.hair), eyes = pick(A.eyes, c.eyes), mouth = pick(A.mouth, c.mouth), top = pick(A.top, c.top), acc = pick(A.acc, c.acc);
  const hairBack = { long: `<path d="M22 50 Q22 18 50 18 Q78 18 78 50 L80 84 L66 84 L66 50 L34 50 L34 84 L20 84Z" fill="${hc}"/>`, curly: `<circle cx="30" cy="36" r="12" fill="${hc}"/><circle cx="70" cy="36" r="12" fill="${hc}"/><circle cx="50" cy="24" r="14" fill="${hc}"/>`, bun: `<circle cx="50" cy="14" r="9" fill="${hc}"/>`, short: '', bald: '' }[hair];
  const hairFront = { short: `<path d="M28 42 Q30 20 50 20 Q70 20 72 42 Q60 32 50 32 Q40 32 28 42Z" fill="${hc}"/>`, long: `<path d="M28 42 Q30 20 50 20 Q70 20 72 42 Q60 30 50 30 Q40 30 28 42Z" fill="${hc}"/>`, curly: `<path d="M28 42 Q32 24 50 24 Q68 24 72 42 Q60 34 50 34 Q40 34 28 42Z" fill="${hc}"/>`, bun: `<path d="M28 42 Q30 22 50 22 Q70 22 72 42 Q60 32 50 32 Q40 32 28 42Z" fill="${hc}"/>`, bald: '' }[hair];
  const eyeSvg = { round: '<circle cx="42" cy="48" r="3"/><circle cx="58" cy="48" r="3"/>', wide: '<circle cx="42" cy="48" r="4.5"/><circle cx="58" cy="48" r="4.5"/>', happy: '<path d="M38 49 Q42 44 46 49M54 49 Q58 44 62 49" stroke="#111" stroke-width="2.4" fill="none"/>', sleepy: '<path d="M38 48 H46M54 48 H62" stroke="#111" stroke-width="2.4"/>' }[eyes];
  const mouthSvg = { smile: '<path d="M42 60 Q50 67 58 60" stroke="#7f1d1d" stroke-width="2.6" fill="none" stroke-linecap="round"/>', grin: '<path d="M40 59 Q50 70 60 59Z" fill="#fff" stroke="#7f1d1d" stroke-width="2"/>', flat: '<path d="M43 62 H57" stroke="#7f1d1d" stroke-width="2.6" stroke-linecap="round"/>', open: '<ellipse cx="50" cy="62" rx="5" ry="4" fill="#7f1d1d"/>' }[mouth];
  const topSvg = { tee: `<path d="M18 100 Q20 76 50 74 Q80 76 82 100Z" fill="${tc}"/>`, hoodie: `<path d="M16 100 Q18 74 50 72 Q82 74 84 100Z" fill="${tc}"/><path d="M38 74 Q50 84 62 74" stroke="#0006" stroke-width="3" fill="none"/>`, suit: `<path d="M18 100 Q20 76 50 74 Q80 76 82 100Z" fill="${tc}"/><path d="M50 76 L42 100 H58Z" fill="#fff"/>` }[top];
  const accSvg = { none: '', glasses: '<g fill="none" stroke="#111" stroke-width="2"><circle cx="42" cy="48" r="7"/><circle cx="58" cy="48" r="7"/><path d="M49 48 H51"/></g>', cap: `<path d="M26 38 Q50 10 74 38Z" fill="#ef4444"/><rect x="24" y="36" width="52" height="5" rx="2" fill="#b91c1c"/>`, headphones: '<path d="M26 50 Q26 20 50 20 Q74 20 74 50" stroke="#111" stroke-width="4" fill="none"/><rect x="22" y="46" width="8" height="14" rx="3" fill="#374151"/><rect x="70" y="46" width="8" height="14" rx="3" fill="#374151"/>' }[acc];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="avatar"><rect width="100" height="100" rx="18" fill="${bg}"/>${hairBack}${topSvg}<rect x="44" y="62" width="12" height="14" fill="${skin}"/><ellipse cx="50" cy="48" rx="22" ry="25" fill="${skin}"/><g fill="#111">${eyeSvg}</g>${mouthSvg}${hairFront}${accSvg}</svg>`;
  const w = h('span', { style: `display:inline-block;width:${size}px;height:${size}px;flex:none` }); w.innerHTML = svg; return w;   // svg built only from allow-listed values
};

// ---------- shell ----------
const root = h('div', { id: 'ac-root', role: 'dialog', 'aria-label': 'Academy', 'data-no-i18n': true });
const top = h('div', { class: 'ac-top' });
const main = h('div', { class: 'ac-main' });
root.append(top, main);
AC.main = main;
let current = null;
AC.go = async (name, arg) => {
  current = name; main.replaceChildren(h('p', { class: 'ac-muted' }, t('loading'))); renderTop();
  try { const view = await AC.views[name](arg); if (current === name) main.replaceChildren(view); }
  catch (e) { main.replaceChildren(h('p', { class: 'ac-card' }, AC.errMsg(e))); console.error(e); }
};
function navItems() {
  const p = AC.state.profile; if (!p) return [];
  if (p.role === 'teacher') return p.must_change_password ? [] : [['t_students', 'students'], ['t_assign', 'assignments'], ['t_subs', 'submissions'], ['t_chal', 'tchallenges'], ['t_announce', 'announce'], ['s_chat', 'chat'], ['t_stats', 'stats'], ['t_reports', 'reports'], ['s_board', 'board']];
  return [['s_home', 'home'], ['s_challenges', 'challenges'], ['s_board', 'board'], ['s_chat', 'chat'], ['s_profile', 'profile']];
}
function renderTop() {
  const p = AC.state.profile;
  top.replaceChildren(
    h('strong', {}, t('academy')),
    h('nav', { class: 'ac-nav', 'aria-label': 'Academy' }, navItems().map(([k, v]) => h('button', { class: current === v ? 'on' : '', onclick: () => AC.go(v) }, t(k)))),
    h('span', { class: 'sp' }),
    p && p.role === 'student' ? h('button', { class: 'ac-btn ac-bell', 'aria-label': t('s_notif'), onclick: () => AC.go('notifications') }, '🔔', AC.state.unread ? h('b', {}, AC.state.unread) : null) : null,
    p ? h('button', { class: 'ac-btn', onclick: () => AC.sb.auth.signOut() }, t('logout')) : null,
    h('button', { class: 'ac-btn', onclick: () => root.classList.remove('on') }, t('close')));
}
AC.refreshUnread = async () => {
  if (AC.state.profile?.role !== 'student') return;
  const { count } = await AC.sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  AC.state.unread = count || 0; renderTop();
};

// ---------- auth views ----------
AC.views.auth = () => {
  let mode = 'login'; const box = h('div', { class: 'ac-auth ac-card' });
  const draw = () => box.replaceChildren(h('div', { class: 'ac-tabs' },
    h('button', { class: 'ac-btn' + (mode === 'login' ? ' pri' : ''), onclick: () => { mode = 'login'; draw(); } }, t('login')),
    h('button', { class: 'ac-btn' + (mode === 'register' ? ' pri' : ''), onclick: () => { mode = 'register'; draw(); } }, t('register'))),
    mode === 'login' ? loginForm(() => { mode = 'forgot'; draw(); }) : mode === 'register' ? registerForm() : forgotForm(() => { mode = 'login'; draw(); }));
  draw(); return box;
};
function loginForm(onForgot) {
  const f = h('form', {}, AC.field(t('identifier'), AC.input('text', 'id', { autocomplete: 'username', required: true })), AC.field(t('password'), AC.input('password', 'pw', { autocomplete: 'current-password', required: true })),
    h('button', { class: 'ac-btn pri', type: 'submit' }, t('login')), ' ', h('button', { class: 'ac-btn', type: 'button', onclick: onForgot }, t('forgot')), h('p', { class: 'ac-muted', id: 'ac-msg', role: 'alert' }));
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const msg = f.querySelector('#ac-msg'); msg.textContent = '';
    try {
      const { session } = await AC.api('/api/login', { identifier: f.id.value.trim(), password: f.pw.value }, false);
      const { error } = await AC.sb.auth.setSession(session); if (error) throw error;
    } catch (err) { msg.textContent = err.status === 429 ? t('err_many') : t('err_creds'); }
  });
  return f;
}
function registerForm() {
  const f = h('form', {}, AC.field(t('fullname'), AC.input('text', 'name', { required: true, maxlength: 80 })), AC.field(t('username'), AC.input('text', 'user', { required: true, autocomplete: 'username' })),
    AC.field(t('email'), AC.input('email', 'email', { required: true, autocomplete: 'email' })), AC.field(t('password'), AC.input('password', 'pw', { required: true, autocomplete: 'new-password' })),
    AC.field(t('password2'), AC.input('password', 'pw2', { required: true, autocomplete: 'new-password' })),
    h('label', { class: 'ac-opt' }, h('input', { type: 'checkbox', name: 'terms' }), t('terms')),
    h('button', { class: 'ac-btn pri', type: 'submit' }, t('register')), h('p', { class: 'ac-muted', id: 'ac-msg', role: 'alert' }));
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const msg = f.querySelector('#ac-msg'); const u = f.user.value.trim(), em = f.email.value.trim();
    if (!/^[A-Za-z0-9_]{3,24}$/.test(u)) return (msg.textContent = t('err_user'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return (msg.textContent = t('err_email'));
    if (!PW(f.pw.value)) return (msg.textContent = t('err_pw'));
    if (f.pw.value !== f.pw2.value) return (msg.textContent = t('err_pw_match'));
    if (!f.terms.checked) return (msg.textContent = t('err_terms'));
    try {
      if (!(await AC.rpc('username_available', { u }))) return (msg.textContent = t('err_taken'));
      const { error } = await AC.sb.auth.signUp({ email: em, password: f.pw.value, options: { emailRedirectTo: location.origin + '/?academy=verified', data: { username: u, full_name: f.name.value.trim(), terms: true } } });
      if (error) throw error;
      f.replaceChildren(h('p', {}, t('check_email')), resendBtn(em));
    } catch (err) { msg.textContent = /already|registered/i.test(err.message) ? t('generic_reset') : t('err_generic'); }
  });
  return f;
}
const resendBtn = (email) => h('button', { class: 'ac-btn', onclick: async (e) => { e.target.disabled = true; try { await AC.api('/api/resend-verification', { email }, false); AC.toast(t('generic_reset')); } catch { AC.toast(t('err_many'), true); } setTimeout(() => (e.target.disabled = false), 30000); } }, t('resend'));
function forgotForm(back) {
  const f = h('form', {}, AC.field(t('email'), AC.input('email', 'email', { required: true })), h('button', { class: 'ac-btn pri', type: 'submit' }, t('send')), ' ', h('button', { class: 'ac-btn', type: 'button', onclick: back }, t('cancel')), h('p', { class: 'ac-muted', id: 'ac-msg', role: 'status' }));
  f.addEventListener('submit', async (e) => { e.preventDefault(); try { await AC.api('/api/forgot-password', { email: f.email.value.trim() }, false); f.querySelector('#ac-msg').textContent = t('generic_reset'); } catch { f.querySelector('#ac-msg').textContent = t('err_many'); } });
  return f;
}
// Recovery link lands here with a temporary recovery session; forced change for seeded teacher reuses it.
AC.views.setPassword = (forced) => {
  const f = h('form', { class: 'ac-auth ac-card' }, h('h3', {}, forced ? t('must_change') : t('reset_title')), AC.field(t('new_password'), AC.input('password', 'pw', { required: true, autocomplete: 'new-password' })),
    AC.field(t('password2'), AC.input('password', 'pw2', { required: true, autocomplete: 'new-password' })), h('button', { class: 'ac-btn pri', type: 'submit' }, t('set_password')), h('p', { class: 'ac-muted', id: 'ac-msg', role: 'alert' }));
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const msg = f.querySelector('#ac-msg');
    if (!PW(f.pw.value)) return (msg.textContent = t('err_pw')); if (f.pw.value !== f.pw2.value) return (msg.textContent = t('err_pw_match'));
    const { error } = await AC.sb.auth.updateUser({ password: f.pw.value }); if (error) return (msg.textContent = /same|different/i.test(error.message) ? t('err_pw') : t('err_generic'));
    if (forced) await AC.rpc('clear_must_change_password');
    AC.toast(t('pw_changed')); history.replaceState({}, '', location.pathname); AC.recovery = false; await boot();
  });
  return f;
};

// ---------- avatar editor ----------
AC.views.avatarEditor = () => {
  const p = AC.state.profile; const cfg = { ...AC.defaultAvatar(), ...(p.avatar || {}) }; let name = p.display_name || p.username;
  const prev = h('div', { class: 'ac-row' }), box = h('div', { class: 'ac-card' });
  const redraw = () => prev.replaceChildren(AC.avatarEl(cfg, 160));
  const sel = (label, key, list, isColor) => AC.field(t(label), h('div', { class: 'ac-row' }, list.map((v) => h('button', { type: 'button', class: 'ac-btn' + (cfg[key] === v ? ' pri' : ''), 'aria-label': v, style: isColor ? `background:${v};min-width:34px` : '', onclick: (e) => { cfg[key] = v; box.querySelectorAll(`[data-k="${key}"]`).forEach((b) => b.classList.remove('pri')); e.currentTarget.classList.add('pri'); redraw(); }, 'data-k': key }, isColor ? '' : v === 'none' ? t('none') : v))));
  const nameIn = h('input', { class: 'ac-in', value: name, maxlength: 30, oninput: (e) => (name = e.target.value) });
  box.append(h('h3', {}, t('av_title')), prev, AC.field(t('av_name'), nameIn), sel('skin', 'skin', A.skin, true), sel('hair', 'hair', A.hair), sel('hairc', 'hairColor', A.hairColor, true), sel('eyes', 'eyes', A.eyes), sel('mouth', 'mouth', A.mouth),
    sel('top', 'top', A.top), sel('topc', 'topColor', A.topColor, true), sel('acc', 'acc', A.acc), sel('bg', 'bg', A.bg, true),
    h('button', { class: 'ac-btn pri', onclick: async () => { try { await AC.rpc('save_avatar', { cfg, dname: name }); AC.toast(t('save') + ' ✓'); await loadProfile(); AC.go('profile'); } catch (e) { AC.toast(AC.errMsg(e), true); } } }, t('save')));
  redraw(); return box;
};

// ---------- boot ----------
async function loadProfile() {
  const { data: { user } } = await AC.sb.auth.getUser(); AC.state.user = user || null;
  if (!user) { AC.state.profile = null; return; }
  const { data } = await AC.sb.from('profiles').select('*').eq('id', user.id).single();
  AC.state.profile = data ? { ...data, verified: !!user.email_confirmed_at, email: user.email } : null;
}
async function boot() {
  await loadProfile(); const p = AC.state.profile; current = null; renderTop();
  if (AC.recovery) return main.replaceChildren(AC.views.setPassword(false));
  if (!p) return main.replaceChildren(AC.views.auth());
  if (p.must_change_password) return main.replaceChildren(AC.views.setPassword(true));
  if (p.role === 'student' && !p.verified) return main.replaceChildren(AC.card(h('p', {}, t('verify_needed')), resendBtn(p.email)));
  if (p.role === 'student' && !p.avatar) return main.replaceChildren(AC.views.avatarEditor());
  AC.refreshUnread(); AC.go(p.role === 'teacher' ? 'students' : 'home');
}
AC.reloadProfile = loadProfile;

(async function init() {
  document.body.append(root, h('button', { id: 'ac-open', 'data-no-i18n': true, onclick: () => root.classList.add('on') }, t('academy')));
  window.addEventListener('langchange', () => { const b = document.getElementById('ac-open'); if (b) b.textContent = t('academy'); if (AC.sb) boot(); });
  let cfg; try { cfg = await (await fetch('/api/config')).json(); } catch { main.replaceChildren(AC.card('Server unavailable. Start it with: npm start')); return; }
  AC.cfg = cfg;
  if (!window.supabase) { main.replaceChildren(AC.card('Supabase library failed to load.')); return; }
  AC.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  // Existing Gemini assistant: if the server holds a key, route through the authenticated proxy instead of a browser key.
  if (cfg.aiConfigured) { const f = window.fetch; window.fetch = async (u, o) => { const s = String(u && u.url || u); if (/generativelanguage\.googleapis\.com\/v1beta\/models/.test(s)) { const { data: { session } } = await AC.sb.auth.getSession(); if (session) return f(s.replace(/^.*\/v1beta\/models/, '/api/gemini'), { ...o, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token } }); } return f(u, o); }; }
  const qs = new URLSearchParams(location.search).get('academy');
  if (location.hash.includes('type=recovery') || qs === 'reset') AC.recovery = true;
  if (AC.recovery || qs) root.classList.add('on');
  AC.sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') AC.recovery = true; if (ev !== 'TOKEN_REFRESHED') setTimeout(boot, 0); });
  await boot();
  if (qs === 'verified') AC.toast(L() ? 'Email verified ✓' : 'تم تأكيد البريد ✓');
})();
})();
