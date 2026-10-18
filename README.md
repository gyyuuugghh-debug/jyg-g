# Alpha LogicX + Academy

The original Alpha LogicX site (`public/index.html`, unchanged apart from 5 appended tags) now includes a
**🎓 Academy** layer: real accounts, teacher dashboard, assignments, grading/points, challenges, leaderboard,
real-time chat, notifications and Gemini-assisted review.

## Architecture
- **Supabase** (PostgreSQL + Auth + Storage + Realtime): all data, RLS, transactional RPC functions (`supabase/migrations/001_academy.sql`).
- **Express server** (`server/index.js`): serves the site, login-by-username, rate-limited forgot-password/resend, Gemini analysis + proxy, hourly deadline reminders.
- **Frontend** (`public/academy/*.js`): vanilla JS overlay, Arabic/English, RTL/LTR, follows the site's language toggle.
- Security model: browser → Supabase with the anon key under RLS; grades, points, submissions, challenge bonuses and pins can only change through `SECURITY DEFINER` functions that check role and verification. The service-role key and Gemini key exist only in server `.env`.

## Setup
1. Create a Supabase project. In **Authentication → URL Configuration** set Site URL = your `PUBLIC_URL` and add `PUBLIC_URL/**` to Redirect URLs.
2. **Authentication → Providers → Email**: enable "Confirm email". For real delivery configure **SMTP** (Auth → SMTP Settings; Supabase's built-in mailer is heavily rate-limited). Templates (Confirm signup / Reset password) can be edited under Auth → Email Templates; keep `{{ .ConfirmationURL }}`.
3. Run `supabase/migrations/001_academy.sql` in the SQL editor (or `supabase db push`).
4. `cp .env.example .env` and fill `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and the teacher values.
5. `npm install`
6. `npm run seed:teacher` → creates teacher `yaser` (password from `TEACHER_INITIAL_PASSWORD`, flagged `must_change_password`). Then **delete the password from `.env`**. The teacher cannot use any teacher function until the password is changed (enforced in `is_teacher()` in the database).
7. `npm start` → http://localhost:3000 → press **🎓 الأكاديمية**.
8. `npm test` → unit tests (validators, file rules, Gemini prompt/parse).

The login identifier for the teacher is the username `yaser`; the technical email is `TEACHER_EMAIL`.

## Implemented (code written)
Registration (unique username, email, password confirm, terms) with email verification + resend; login by username/email; forgot/reset flow (generic response, rate-limited, Supabase one-time expiring links, dedicated reset screen); forced teacher password change; avatar editor (original SVG, persisted); student profile (level, points, achievements, history); teacher directory with search and points adjustments (ledger); assignment builder (text/MCQ/file, mixed, targets, deadlines, late policy, bonus, attachments); student dashboard (new/in-progress/submitted/graded, DB drafts + autosave, confirm submit, server timestamps, late flag); server-side MCQ grading with hidden answer key; teacher grading with partial credit, feedback, idempotent points ledger (corrections recorded as deltas); challenges with atomic first-valid-submission bonus; weekly/all-time leaderboard (public fields only); Realtime chat with uploads, delete, report, pin, teacher moderation; DB notifications (publish, deadline, graded, points, challenge, announcement, new submission); teacher stats; Gemini analysis per answer (advisory only, AI-indicator check opt-in with explicit limitations); audit log.

## NOT verified — be aware
This code was written in a sandbox **without network access**: I could not install npm packages, run PostgreSQL/Supabase, send email, or call Gemini. Only these were actually run: `node --check` on every JS file and `npm test` (6 unit tests, all passing).
Therefore **untested**: the SQL migration (never executed — expect to fix small syntax/policy issues on first run), RLS behaviour, all end-to-end flows in section 17 of your spec (email verification/reset delivery, two-account realtime chat, uploads, challenge race, leaderboard accuracy, restart persistence, responsive layouts, real Gemini calls and missing-key handling in a live server). Please run through them after setup and report failures.

## Known gaps / limitations
- No automated database or browser end-to-end tests yet.
- Deleted/pinned chat messages reach other clients via 30-second refresh (soft-deleted rows are not broadcast under RLS).
- Student answers for MCQ show scores only once graded in the UI, but `answers.score` is technically readable by the owner earlier.
- Attachments are stored as JSON (`answers.files`, `messages.attachment`, `questions.attachments`) rather than a separate table.
- Groups are not implemented; assignments target "everyone" or selected students.
- Late policy: allow (flagged late) or block; no automatic deductions exist.
- The old browser-side Gemini key box still works if the server has no `GEMINI_API_KEY`; with a server key, calls are routed through `/api/gemini` (login required).
- CSP is disabled in helmet because the legacy site relies on inline scripts.
- Rate limiting is in-memory per server instance.
