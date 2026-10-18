'use strict';
// One-time, server-side teacher seed. Reads credentials from .env (never from the frontend).
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const e = process.env;
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TEACHER_USERNAME', 'TEACHER_EMAIL', 'TEACHER_INITIAL_PASSWORD']) {
  if (!e[k]) { console.error('Missing ' + k); process.exit(1); }
}
const admin = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
(async () => {
  const { data: existing } = await admin.from('profiles').select('id').eq('username', e.TEACHER_USERNAME).maybeSingle();
  if (existing) { console.log('Teacher already exists — nothing to do.'); return; }
  const { data, error } = await admin.auth.admin.createUser({
    email: e.TEACHER_EMAIL, password: e.TEACHER_INITIAL_PASSWORD, email_confirm: true,
    user_metadata: { username: e.TEACHER_USERNAME, full_name: e.TEACHER_DISPLAY_NAME || e.TEACHER_USERNAME, terms: true },
  });
  if (error) { console.error('Create failed:', error.message); process.exit(1); }
  const { error: pe } = await admin.from('profiles').update({ role: 'teacher', must_change_password: true, display_name: e.TEACHER_DISPLAY_NAME || e.TEACHER_USERNAME }).eq('id', data.user.id);
  if (pe) { console.error('Profile update failed:', pe.message); process.exit(1); }
  console.log(`Teacher "${e.TEACHER_USERNAME}" created. Password change is REQUIRED at first login. Now remove TEACHER_INITIAL_PASSWORD from .env.`);
})();
