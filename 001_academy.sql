-- Alpha LogicX Academy — schema, RLS, transactional RPCs, storage policies.
-- Run in the Supabase SQL editor or: supabase db push

create extension if not exists citext;
create extension if not exists pgcrypto;

-- ============ Tables ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext not null unique check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  full_name text not null check (char_length(full_name) between 2 and 80),
  display_name text,
  role text not null default 'student' check (role in ('student','teacher')),
  avatar jsonb,
  total_points integer not null default 0,
  must_change_password boolean not null default false,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  instructions text not null default '',
  kind text not null default 'assignment' check (kind in ('assignment','quiz')),
  status text not null default 'draft' check (status in ('draft','published')),
  deadline timestamptz,
  late_policy text not null default 'allow' check (late_policy in ('allow','block')),
  bonus_points integer not null default 0 check (bonus_points >= 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table public.assignment_targets (
  assignment_id uuid references public.assignments(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  primary key (assignment_id, student_id)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  position integer not null default 0,
  type text not null check (type in ('text','mcq','file')),
  prompt text not null check (char_length(prompt) > 0),
  notes text,
  grading_criteria text,            -- teacher-only; sent to Gemini, never to students
  points numeric(6,2) not null default 1 check (points >= 0),
  multiple boolean not null default false,
  attachments jsonb not null default '[]'
);
create index on public.questions(assignment_id, position);

create table public.choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  position integer not null default 0,
  label text not null,
  is_correct boolean not null default false   -- teacher-only via RLS
);
create index on public.choices(question_id);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','submitted','graded')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  is_late boolean not null default false,
  total_score numeric(7,2),
  feedback text,
  graded_by uuid references public.profiles(id),
  graded_at timestamptz,
  unique (assignment_id, student_id)
);
create index on public.submissions(student_id, status);
create index on public.submissions(status, submitted_at);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  text_answer text,
  selected_choice_ids uuid[] not null default '{}',
  files jsonb not null default '[]',   -- [{path,name,mime,size}] in private bucket "submissions"
  score numeric(6,2) check (score >= 0),
  feedback text,
  auto_graded boolean not null default false,
  unique (submission_id, question_id)
);

create table public.points_transactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount <> 0),
  kind text not null check (kind in ('grade','correction','challenge_base','challenge_bonus','deduction','manual')),
  reason text not null,
  ref_type text, ref_id uuid,
  actor_id uuid references public.profiles(id),
  idempotency_key text unique,
  created_at timestamptz not null default now()
);
create index on public.points_transactions(student_id, created_at);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null, description text not null default '',
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz not null check (ends_at > starts_at),
  base_points integer not null default 0 check (base_points >= 0),
  bonus_points integer not null default 0 check (bonus_points >= 0),
  winner_id uuid references public.profiles(id),
  winner_submission_id uuid references public.submissions(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.challenge_entries (
  challenge_id uuid references public.challenges(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  primary key (challenge_id, student_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null, title text not null, body text,
  data jsonb not null default '{}',
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index on public.notifications(user_id, read_at, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text check (body is null or char_length(body) <= 2000),
  attachment jsonb,                    -- {path,name,mime,size} in private bucket "chat"
  pinned boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (body is not null or attachment is not null)
);
create index on public.messages(created_at desc);

create table public.message_reports (
  message_id uuid references public.messages(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete cascade,
  reason text, created_at timestamptz not null default now(),
  primary key (message_id, reporter_id)
);

create table public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  model text not null, include_ai_indicators boolean not null default false,
  report jsonb not null, created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigserial primary key,
  actor_id uuid references public.profiles(id),
  action text not null, target_type text, target_id text,
  details jsonb, created_at timestamptz not null default now()
);

-- ============ Helpers ============
create or replace function public.is_verified() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null)
$$;

-- Teacher = role teacher AND initial password already changed.
create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher' and not must_change_password)
$$;

create or replace function public.level_for(p integer) returns integer
language sql immutable as $$ select 1 + floor(sqrt(greatest(p,0) / 50.0))::int $$;

create or replace function public.audit(a text, tt text, tid text, d jsonb default null) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_log(actor_id, action, target_type, target_id, details) values (auth.uid(), a, tt, tid, d)
$$;

create or replace function public.notify(uid uuid, t text, ti text, b text, d jsonb default '{}', dk text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, type, title, body, data, dedupe_key)
  values (uid, t, ti, b, d, dk) on conflict (user_id, dedupe_key) do nothing
$$;

-- Students are always created with role 'student'; metadata can never set a role.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, username, full_name, display_name, role, terms_accepted_at)
  values (new.id,
          new.raw_user_meta_data->>'username',
          coalesce(new.raw_user_meta_data->>'full_name', 'Student'),
          new.raw_user_meta_data->>'username',
          'student',
          case when (new.raw_user_meta_data->>'terms')::boolean then now() end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ledger drives total_points (single writer = trigger).
create or replace function public.apply_points() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set total_points = greatest(0, total_points + new.amount) where id = new.student_id;
  return new;
end $$;
create trigger ledger_apply after insert on public.points_transactions
  for each row execute function public.apply_points();

-- Block direct edits to protected profile columns even via service paths other than RPCs.
create or replace function public.guard_profile() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated','anon') then
    new.role := old.role; new.total_points := old.total_points;
    new.must_change_password := old.must_change_password; new.username := old.username;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile();

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_targets enable row level security;
alter table public.questions enable row level security;
alter table public.choices enable row level security;
alter table public.submissions enable row level security;
alter table public.answers enable row level security;
alter table public.points_transactions enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_entries enable row level security;
alter table public.notifications enable row level security;
alter table public.messages enable row level security;
alter table public.message_reports enable row level security;
alter table public.ai_reports enable row level security;
alter table public.audit_log enable row level security;

-- profiles: self (full row) or teacher. Others see only the public_profiles view (no private data).
create policy p_self on public.profiles for select to authenticated using (id = auth.uid() or public.is_teacher());
create policy p_self_upd on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create view public.public_profiles with (security_invoker = false) as
  select id, username, coalesce(display_name, username) as display_name, avatar,
         total_points, public.level_for(total_points) as level, role
  from public.profiles;
grant select on public.public_profiles to authenticated;

-- assignments: teacher all; student only published + assigned (no targets = everyone).
create policy a_teacher on public.assignments for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy a_student on public.assignments for select to authenticated using (
  status = 'published' and public.is_verified() and (
    not exists (select 1 from public.assignment_targets t where t.assignment_id = id)
    or exists (select 1 from public.assignment_targets t where t.assignment_id = id and t.student_id = auth.uid())));
create policy t_teacher on public.assignment_targets for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy t_self on public.assignment_targets for select to authenticated using (student_id = auth.uid());

-- questions: teacher all. Students read via get_assignment() RPC only (hides criteria).
create policy q_teacher on public.questions for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
-- choices: teacher only (is_correct stays secret). Students get labels via get_assignment().
create policy c_teacher on public.choices for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

-- submissions/answers: read own or teacher. ALL writes go through RPCs (security definer).
create policy s_read on public.submissions for select to authenticated using (student_id = auth.uid() or public.is_teacher());
create policy ans_read on public.answers for select to authenticated using (
  public.is_teacher() or exists (select 1 from public.submissions s where s.id = submission_id and s.student_id = auth.uid()));

create policy pt_read on public.points_transactions for select to authenticated using (student_id = auth.uid() or public.is_teacher());

create policy ch_read on public.challenges for select to authenticated using (public.is_verified());
create policy ch_teacher on public.challenges for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy ce_read on public.challenge_entries for select to authenticated using (student_id = auth.uid() or public.is_teacher());

create policy n_read on public.notifications for select to authenticated using (user_id = auth.uid());

-- chat: verified users read/send; delete own; teacher deletes any. Pin via RPC.
create policy m_read on public.messages for select to authenticated using (public.is_verified() and deleted_at is null);
create policy m_ins on public.messages for insert to authenticated with check (public.is_verified() and sender_id = auth.uid() and pinned = false);
create policy mr_ins on public.message_reports for insert to authenticated with check (reporter_id = auth.uid() and public.is_verified());
create policy mr_read on public.message_reports for select to authenticated using (public.is_teacher());

create policy ai_teacher on public.ai_reports for select to authenticated using (public.is_teacher());
create policy audit_teacher on public.audit_log for select to authenticated using (public.is_teacher());

-- Revoke table-level writes where RPC is the only path.
revoke insert, update, delete on public.submissions, public.answers, public.points_transactions,
  public.challenge_entries, public.notifications, public.ai_reports, public.audit_log from authenticated, anon;
revoke update, delete on public.messages from authenticated;
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- ============ RPC: availability ============
create or replace function public.username_available(u text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where username = u)
$$;
grant execute on function public.username_available(text) to anon, authenticated;

create or replace function public.clear_must_change_password() returns void
language sql security definer set search_path = public as $$
  update public.profiles set must_change_password = false where id = auth.uid()
$$;

-- ============ RPC: avatar ============
create or replace function public.save_avatar(cfg jsonb, dname text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_verified() then raise exception 'email_not_verified'; end if;
  if jsonb_typeof(cfg) <> 'object' or char_length(cfg::text) > 1000 then raise exception 'invalid_avatar'; end if;
  if dname is null or char_length(trim(dname)) not between 2 and 30 then raise exception 'invalid_name'; end if;
  update public.profiles set avatar = cfg, display_name = trim(dname) where id = auth.uid();
end $$;

-- ============ RPC: assignment for student (hides answer key & criteria) ============
create or replace function public.get_assignment(aid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.assignments; res jsonb;
begin
  select * into a from public.assignments where id = aid;
  if not found then raise exception 'not_found'; end if;
  if not public.is_teacher() then
    if a.status <> 'published' or not public.is_verified() then raise exception 'forbidden'; end if;
    if exists (select 1 from public.assignment_targets where assignment_id = aid)
       and not exists (select 1 from public.assignment_targets where assignment_id = aid and student_id = auth.uid())
    then raise exception 'forbidden'; end if;
  end if;
  select jsonb_build_object(
    'id', a.id, 'title', a.title, 'instructions', a.instructions, 'kind', a.kind, 'deadline', a.deadline,
    'late_policy', a.late_policy, 'bonus_points', a.bonus_points,
    'questions', coalesce((select jsonb_agg(jsonb_build_object(
        'id', q.id, 'type', q.type, 'prompt', q.prompt, 'notes', q.notes, 'points', q.points,
        'multiple', q.multiple, 'attachments', q.attachments,
        'choices', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.label) order by c.position)
                             from public.choices c where c.question_id = q.id), '[]'))
      order by q.position) from public.questions q where q.assignment_id = a.id), '[]'))
  into res;
  return res;
end $$;

-- ============ RPC: teacher assignment builder (atomic) ============
create or replace function public.save_assignment(payload jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare aid uuid; q jsonb; qid uuid; c jsonb; i int := 0; j int;
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  if jsonb_array_length(coalesce(payload->'questions','[]')) = 0 then raise exception 'no_questions'; end if;
  aid := nullif(payload->>'id','')::uuid;
  if aid is null then
    insert into public.assignments(title, instructions, kind, deadline, late_policy, bonus_points, created_by)
    values (payload->>'title', coalesce(payload->>'instructions',''), coalesce(payload->>'kind','assignment'),
            nullif(payload->>'deadline','')::timestamptz, coalesce(payload->>'late_policy','allow'),
            coalesce((payload->>'bonus_points')::int,0), auth.uid()) returning id into aid;
  else
    update public.assignments set title = payload->>'title', instructions = coalesce(payload->>'instructions',''),
      kind = coalesce(payload->>'kind','assignment'), deadline = nullif(payload->>'deadline','')::timestamptz,
      late_policy = coalesce(payload->>'late_policy','allow'), bonus_points = coalesce((payload->>'bonus_points')::int,0)
    where id = aid;
    if exists (select 1 from public.submissions where assignment_id = aid) then
      raise exception 'has_submissions';      -- questions are frozen once students started
    end if;
    delete from public.questions where assignment_id = aid;
  end if;
  delete from public.assignment_targets where assignment_id = aid;
  insert into public.assignment_targets(assignment_id, student_id)
    select aid, x::uuid from jsonb_array_elements_text(coalesce(payload->'targets','[]')) x;
  for q in select * from jsonb_array_elements(payload->'questions') loop
    i := i + 1;
    insert into public.questions(assignment_id, position, type, prompt, notes, grading_criteria, points, multiple, attachments)
    values (aid, i, q->>'type', q->>'prompt', q->>'notes', q->>'grading_criteria',
            coalesce((q->>'points')::numeric, 1), coalesce((q->>'multiple')::boolean,false),
            coalesce(q->'attachments','[]')) returning id into qid;
    if q->>'type' = 'mcq' then
      if (select count(*) from jsonb_array_elements(q->'choices') x where (x->>'is_correct')::boolean) = 0 then
        raise exception 'mcq_needs_correct_choice';
      end if;
      j := 0;
      for c in select * from jsonb_array_elements(q->'choices') loop
        j := j + 1;
        insert into public.choices(question_id, position, label, is_correct)
        values (qid, j, c->>'label', coalesce((c->>'is_correct')::boolean,false));
      end loop;
    end if;
  end loop;
  perform public.audit('assignment_saved', 'assignment', aid::text);
  return aid;
end $$;

create or replace function public.publish_assignment(aid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a public.assignments;
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  update public.assignments set status = 'published', published_at = coalesce(published_at, now())
    where id = aid and status = 'draft' returning * into a;
  if not found then return; end if;            -- already published: no duplicate notifications
  perform public.notify(p.id, 'assignment', a.title, a.instructions, jsonb_build_object('assignment_id', aid), 'pub:'||aid)
  from public.profiles p where p.role = 'student' and (
    not exists (select 1 from public.assignment_targets t where t.assignment_id = aid)
    or exists (select 1 from public.assignment_targets t where t.assignment_id = aid and t.student_id = p.id));
  perform public.audit('assignment_published', 'assignment', aid::text);
end $$;

create or replace function public.delete_assignment(aid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  delete from public.assignments where id = aid;
  perform public.audit('assignment_deleted', 'assignment', aid::text);
end $$;

-- ============ RPC: student drafts & submission ============
create or replace function public.save_draft(aid uuid, ans jsonb) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare s public.submissions; a public.assignments; x jsonb;
begin
  if not public.is_verified() then raise exception 'email_not_verified'; end if;
  perform public.get_assignment(aid);                                    -- visibility check
  select * into a from public.assignments where id = aid;
  insert into public.submissions(assignment_id, student_id) values (aid, auth.uid())
    on conflict (assignment_id, student_id) do nothing;
  select * into s from public.submissions where assignment_id = aid and student_id = auth.uid() for update;
  if s.status <> 'draft' then raise exception 'already_submitted'; end if;
  for x in select * from jsonb_array_elements(coalesce(ans,'[]')) loop
    if not exists (select 1 from public.questions where id = (x->>'question_id')::uuid and assignment_id = aid)
      then raise exception 'bad_question'; end if;
    insert into public.answers(submission_id, question_id, text_answer, selected_choice_ids, files)
    values (s.id, (x->>'question_id')::uuid, left(x->>'text_answer', 20000),
            coalesce((select array_agg(v::uuid) from jsonb_array_elements_text(coalesce(x->'selected_choice_ids','[]')) v), '{}'),
            coalesce(x->'files','[]'))
    on conflict (submission_id, question_id) do update
      set text_answer = excluded.text_answer, selected_choice_ids = excluded.selected_choice_ids, files = excluded.files;
  end loop;
  return now();
end $$;

-- Internal: sum of awarded points for a ref, add delta idempotently.
create or replace function public.award_delta(sid uuid, stu uuid, total integer, why text, actor uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare done integer; delta integer;
begin
  select coalesce(sum(amount),0) into done from public.points_transactions
    where ref_type = 'submission' and ref_id = sid and kind in ('grade','correction');
  delta := total - done;
  if delta <> 0 then
    insert into public.points_transactions(student_id, amount, kind, reason, ref_type, ref_id, actor_id)
    values (stu, delta, case when done = 0 then 'grade' else 'correction' end, why, 'submission', sid, actor);
  end if;
  return delta;
end $$;

create or replace function public.finalize_submission(sid uuid, actor uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s public.submissions; a public.assignments; total numeric; d integer;
begin
  select * into s from public.submissions where id = sid for update;
  select * into a from public.assignments where id = s.assignment_id;
  select coalesce(sum(score),0) into total from public.answers where submission_id = sid;
  update public.submissions set status = 'graded', total_score = total, graded_by = actor, graded_at = now() where id = sid;
  d := public.award_delta(sid, s.student_id, round(total)::int, 'Grade: ' || a.title, actor);
  if d <> 0 then
    perform public.notify(s.student_id, 'graded', a.title, 'Score: ' || total, jsonb_build_object('submission_id', sid), 'graded:'||sid||':'||total);
    perform public.notify(s.student_id, 'points', 'Points', (case when d > 0 then '+' else '' end) || d, '{}', 'pts:'||sid||':'||d);
  end if;
end $$;

create or replace function public.submit_assignment(aid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.assignments; s public.submissions; q public.questions; ans public.answers;
        n_ok int; n_sel int; sc numeric; manual boolean := false; late boolean; ch public.challenges; nonempty boolean;
begin
  if not public.is_verified() then raise exception 'email_not_verified'; end if;
  perform public.get_assignment(aid);
  select * into a from public.assignments where id = aid;
  insert into public.submissions(assignment_id, student_id) values (aid, auth.uid()) on conflict do nothing;
  select * into s from public.submissions where assignment_id = aid and student_id = auth.uid() for update;
  if s.status <> 'draft' then raise exception 'already_submitted'; end if;       -- retry-safe: no double processing
  late := a.deadline is not null and now() > a.deadline;
  if late and a.late_policy = 'block' then raise exception 'deadline_passed'; end if;

  select bool_or(coalesce(length(trim(text_answer)),0) > 0 or cardinality(selected_choice_ids) > 0 or jsonb_array_length(files) > 0)
    into nonempty from public.answers where submission_id = s.id;
  if not coalesce(nonempty, false) then raise exception 'empty_submission'; end if;

  for q in select * from public.questions where assignment_id = aid loop
    select * into ans from public.answers where submission_id = s.id and question_id = q.id;
    if q.type = 'mcq' then
      -- All-or-nothing for single; proportional (correct picks minus wrong picks, floor 0) for multiple.
      sc := 0;
      if found then
        select count(*) filter (where is_correct and id = any(ans.selected_choice_ids)),
               count(*) filter (where not is_correct and id = any(ans.selected_choice_ids))
          into n_ok, n_sel from public.choices where question_id = q.id;
        sc := round(q.points * greatest(0, n_ok - n_sel)::numeric /
                    nullif((select count(*) from public.choices where question_id = q.id and is_correct),0), 2);
      end if;
      insert into public.answers(submission_id, question_id, score, auto_graded) values (s.id, q.id, coalesce(sc,0), true)
        on conflict (submission_id, question_id) do update set score = coalesce(sc,0), auto_graded = true;
    else manual := true; end if;
  end loop;

  update public.submissions set status = 'submitted', submitted_at = now(), is_late = late where id = s.id;

  -- Challenge entries (server clock; first valid entry wins atomically under row lock).
  for ch in select * from public.challenges where assignment_id = aid and now() between starts_at and ends_at for update loop
    insert into public.challenge_entries(challenge_id, student_id, submission_id) values (ch.id, auth.uid(), s.id)
      on conflict do nothing;
    if found then
      if ch.base_points > 0 then
        insert into public.points_transactions(student_id, amount, kind, reason, ref_type, ref_id, idempotency_key)
        values (auth.uid(), ch.base_points, 'challenge_base', 'Challenge: ' || ch.title, 'challenge', ch.id, 'cb:'||ch.id||':'||auth.uid())
        on conflict do nothing;
      end if;
      if ch.winner_id is null then
        update public.challenges set winner_id = auth.uid(), winner_submission_id = s.id where id = ch.id;
        if ch.bonus_points > 0 then
          insert into public.points_transactions(student_id, amount, kind, reason, ref_type, ref_id, idempotency_key)
          values (auth.uid(), ch.bonus_points, 'challenge_bonus', 'First submission: ' || ch.title, 'challenge', ch.id, 'bonus:'||ch.id)
          on conflict do nothing;
        end if;
        perform public.notify(auth.uid(), 'challenge', ch.title, 'You won the challenge!', jsonb_build_object('challenge_id', ch.id), 'win:'||ch.id);
      end if;
    end if;
  end loop;

  perform public.notify(p.id, 'submission', a.title, 'New submission', jsonb_build_object('submission_id', s.id), 'sub:'||s.id)
    from public.profiles p where p.role = 'teacher';

  if not manual then perform public.finalize_submission(s.id, null); end if;   -- pure MCQ: auto-final
  return jsonb_build_object('submission_id', s.id, 'late', late, 'auto_graded', not manual);
end $$;

-- ============ RPC: teacher grading ============
create or replace function public.grade_submission(sid uuid, scores jsonb, fb text, finalize boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare x jsonb; q public.questions;
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  perform 1 from public.submissions where id = sid and status in ('submitted','graded') for update;
  if not found then raise exception 'not_submitted'; end if;
  for x in select * from jsonb_array_elements(scores) loop
    select qq.* into q from public.questions qq join public.answers a on a.question_id = qq.id
      where a.id = (x->>'answer_id')::uuid and a.submission_id = sid;
    if not found then raise exception 'bad_answer'; end if;
    if (x->>'score')::numeric < 0 or (x->>'score')::numeric > q.points then raise exception 'score_out_of_range'; end if;
    update public.answers set score = (x->>'score')::numeric, feedback = x->>'feedback', auto_graded = false
      where id = (x->>'answer_id')::uuid;
  end loop;
  update public.submissions set feedback = fb where id = sid;
  if finalize then perform public.finalize_submission(sid, auth.uid()); end if;
  perform public.audit('graded', 'submission', sid::text, jsonb_build_object('finalize', finalize));
end $$;

create or replace function public.adjust_points(stu uuid, amt integer, why text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  if amt = 0 or length(trim(coalesce(why,''))) < 3 then raise exception 'invalid'; end if;
  insert into public.points_transactions(student_id, amount, kind, reason, actor_id)
    values (stu, amt, case when amt < 0 then 'deduction' else 'manual' end, why, auth.uid());
  perform public.notify(stu, 'points', 'Points', (case when amt > 0 then '+' else '' end) || amt || ' — ' || why);
  perform public.audit('points_adjusted', 'profile', stu::text, jsonb_build_object('amount', amt, 'reason', why));
end $$;

-- ============ RPC: notifications / announcements / chat ============
create or replace function public.mark_read(nid uuid default null) returns void
language sql security definer set search_path = public as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null and (nid is null or id = nid)
$$;

create or replace function public.send_announcement(t text, b text, pin boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  insert into public.notifications(user_id, type, title, body, dedupe_key)
    select id, 'announcement', t, b, 'ann:' || gen_random_uuid() from public.profiles where role = 'student';
  insert into public.messages(sender_id, body, pinned) values (auth.uid(), '📢 ' || t || E'\n' || b, pin);
  perform public.audit('announcement', 'broadcast', null, jsonb_build_object('title', t));
end $$;

create or replace function public.delete_message(mid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.messages set deleted_at = now(), pinned = false
    where id = mid and deleted_at is null and (sender_id = auth.uid() or public.is_teacher());
  if not found then raise exception 'forbidden'; end if;
  if public.is_teacher() then perform public.audit('message_removed', 'message', mid::text); end if;
end $$;

create or replace function public.set_pinned(mid uuid, v boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  update public.messages set pinned = v where id = mid;
  perform public.audit('pin', 'message', mid::text, jsonb_build_object('pinned', v));
end $$;

-- Called hourly by the server: deadline reminders (24h), one per student/assignment.
create or replace function public.notify_deadlines() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0;
begin
  insert into public.notifications(user_id, type, title, body, data, dedupe_key)
  select p.id, 'deadline', a.title, 'Deadline approaching', jsonb_build_object('assignment_id', a.id), 'dl:' || a.id
  from public.assignments a join public.profiles p on p.role = 'student'
  where a.status = 'published' and a.deadline between now() and now() + interval '24 hours'
    and (not exists (select 1 from public.assignment_targets t where t.assignment_id = a.id)
         or exists (select 1 from public.assignment_targets t where t.assignment_id = a.id and t.student_id = p.id))
    and not exists (select 1 from public.submissions s where s.assignment_id = a.id and s.student_id = p.id and s.status <> 'draft')
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.notify_deadlines() from public, anon, authenticated;

-- ============ Leaderboard (public fields only) ============
create or replace function public.leaderboard(period text default 'all') returns table (
  rank bigint, user_id uuid, display_name text, avatar jsonb, level int, points bigint,
  completed bigint, challenges_won bigint, bonus_points bigint)
language sql stable security definer set search_path = public as $$
  with pts as (
    select student_id, sum(amount) filter (where period = 'all' or created_at > now() - interval '7 days') as pts,
           coalesce(sum(amount) filter (where kind = 'challenge_bonus'), 0) as bonus
    from public.points_transactions group by student_id)
  select rank() over (order by coalesce(case when period = 'all' then p.total_points else x.pts end, 0) desc),
         p.id, coalesce(p.display_name, p.username)::text, p.avatar, public.level_for(p.total_points),
         coalesce(case when period = 'all' then p.total_points else x.pts end, 0)::bigint,
         (select count(*) from public.submissions s where s.student_id = p.id and s.status = 'graded'),
         (select count(*) from public.challenges c where c.winner_id = p.id),
         coalesce(x.bonus, 0)::bigint
  from public.profiles p left join pts x on x.student_id = p.id
  where p.role = 'student' and public.is_verified()
  order by 1, 3 limit 100
$$;

-- Teacher statistics
create or replace function public.teacher_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'students', (select count(*) from public.profiles where role = 'student'),
    'pending', (select count(*) from public.submissions where status = 'submitted'),
    'graded', (select count(*) from public.submissions where status = 'graded'),
    'avg_pct', (select round(avg(s.total_score / nullif((select sum(points) from public.questions q where q.assignment_id = s.assignment_id),0) * 100), 1)
                from public.submissions s where s.status = 'graded'),
    'per_assignment', coalesce((select jsonb_agg(r) from (
        select a.title, count(s.id) filter (where s.status <> 'draft') as submitted,
               count(s.id) filter (where s.status = 'graded') as graded
        from public.assignments a left join public.submissions s on s.assignment_id = a.id
        where a.status = 'published' group by a.id order by a.created_at desc limit 8) r), '[]'));
end $$;

-- ============ Storage (private buckets, enforced size/type limits) ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
 ('submissions','submissions',false, 10485760, array['image/png','image/jpeg','image/webp','application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
 ('chat','chat',false, 5242880, array['image/png','image/jpeg','image/webp','application/pdf','text/plain']),
 ('assignment-files','assignment-files',false, 10485760, array['image/png','image/jpeg','image/webp','application/pdf','text/plain'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = false;

create policy st_sub_ins on storage.objects for insert to authenticated with check (
  bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text and public.is_verified());
create policy st_sub_sel on storage.objects for select to authenticated using (
  bucket_id = 'submissions' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher()));
create policy st_chat_ins on storage.objects for insert to authenticated with check (
  bucket_id = 'chat' and (storage.foldername(name))[1] = auth.uid()::text and public.is_verified());
create policy st_chat_sel on storage.objects for select to authenticated using (bucket_id = 'chat' and public.is_verified());
create policy st_chat_del on storage.objects for delete to authenticated using (
  bucket_id = 'chat' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher()));
create policy st_af_ins on storage.objects for insert to authenticated with check (bucket_id = 'assignment-files' and public.is_teacher());
create policy st_af_sel on storage.objects for select to authenticated using (bucket_id = 'assignment-files' and public.is_verified());

-- Realtime for chat + notifications
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
