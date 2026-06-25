create extension if not exists pgcrypto;

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  year integer,
  board text,
  role text,
  source_url text,
  source_name text,
  source_page_url text,
  organization text,
  external_id text,
  imported_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references public.exams(id) on delete set null,
  number integer,
  discipline text not null,
  subject text not null,
  topic text,
  subtopic text,
  statement text not null,
  alternatives jsonb not null default '{}'::jsonb,
  correct_answer text check (correct_answer in ('A', 'B', 'C', 'D', 'E')),
  explanation text,
  explanation_status text default 'missing',
  explanation_source text,
  explanation_updated_at timestamp with time zone,
  difficulty text default 'media',
  source_name text,
  source_page_url text,
  source_question_id text,
  import_status text default 'imported',
  import_notes text,
  needs_review boolean default false,
  classification_status text default 'unclassified',
  classification_source text,
  classification_updated_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.exams add column if not exists source_name text;
alter table public.exams add column if not exists source_page_url text;
alter table public.exams add column if not exists organization text;
alter table public.exams add column if not exists external_id text;
alter table public.exams add column if not exists imported_at timestamp with time zone;
alter table public.questions add column if not exists source_name text;
alter table public.questions add column if not exists source_page_url text;
alter table public.questions add column if not exists source_question_id text;
alter table public.questions add column if not exists import_status text default 'imported';
alter table public.questions add column if not exists import_notes text;
alter table public.questions add column if not exists needs_review boolean default false;
alter table public.questions add column if not exists topic text;
alter table public.questions add column if not exists classification_status text default 'unclassified';
alter table public.questions add column if not exists classification_source text;
alter table public.questions add column if not exists classification_updated_at timestamp with time zone;
alter table public.questions add column if not exists explanation_status text default 'missing';
alter table public.questions add column if not exists explanation_source text;
alter table public.questions add column if not exists explanation_updated_at timestamp with time zone;
alter table public.questions alter column correct_answer drop not null;

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  discipline text,
  subject text,
  started_at timestamp with time zone not null default now(),
  finished_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  study_session_id uuid references public.study_sessions(id) on delete set null,
  selected_answer text not null check (selected_answer in ('A', 'B', 'C', 'D', 'E')),
  is_correct boolean not null default false,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.question_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  note text,
  status text default 'aberta',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (user_id, question_id)
);

create table if not exists public.question_option_explanations (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references public.questions(id) on delete cascade,
  option_key text not null,
  explanation text not null,
  explanation_status text default 'missing',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.study_materials (
  id uuid primary key default gen_random_uuid(),
  discipline text not null,
  subject text,
  topic text,
  title text not null,
  content text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.study_materials add column if not exists topic text;

create table if not exists public.import_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  source_type text,
  status text default 'pending',
  notes text,
  created_at timestamp with time zone default now()
);

create table if not exists public.exam_files (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references public.exams(id) on delete cascade,
  file_type text,
  title text,
  url text not null,
  local_path text,
  source_name text,
  status text default 'pending',
  created_at timestamp with time zone default now()
);

alter table public.exam_files add column if not exists exam_id uuid references public.exams(id) on delete cascade;
alter table public.exam_files add column if not exists file_type text;
alter table public.exam_files add column if not exists title text;
alter table public.exam_files add column if not exists url text;
alter table public.exam_files add column if not exists local_path text;
alter table public.exam_files add column if not exists source_name text;
alter table public.exam_files add column if not exists status text default 'pending';
alter table public.exam_files add column if not exists file_extension text;
alter table public.exam_files add column if not exists mime_type text;
alter table public.exam_files add column if not exists processing_status text default 'pending';
alter table public.exam_files add column if not exists processing_error text;
alter table public.exam_files add column if not exists is_processable boolean default true;
alter table public.exam_files add column if not exists created_at timestamp with time zone default now();

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.import_sources(id) on delete set null,
  status text default 'pending',
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  message text
);

create table if not exists public.question_import_reviews (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references public.questions(id) on delete cascade,
  status text default 'pending',
  review_note text,
  created_at timestamp with time zone default now()
);

create table if not exists public.import_discovered_files (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.import_sources(id) on delete set null,
  exam_id uuid references public.exams(id) on delete set null,
  title text,
  url text not null,
  file_type text,
  guessed_year integer,
  guessed_board text,
  guessed_role text,
  normalized_title text,
  inferred_notice_number text,
  inferred_exam_title text,
  inferred_exam_id uuid references public.exams(id) on delete set null,
  inference_confidence numeric default 0,
  inference_notes text,
  is_exam_relevant boolean default false,
  relevance_category text default 'unknown',
  relevance_reason text,
  archived_at timestamp with time zone,
  status text default 'discovered',
  notes text,
  created_at timestamp with time zone default now()
);

alter table public.import_discovered_files add column if not exists normalized_title text;
alter table public.import_discovered_files add column if not exists inferred_notice_number text;
alter table public.import_discovered_files add column if not exists inferred_exam_title text;
alter table public.import_discovered_files add column if not exists inferred_exam_id uuid references public.exams(id) on delete set null;
alter table public.import_discovered_files add column if not exists inference_confidence numeric default 0;
alter table public.import_discovered_files add column if not exists inference_notes text;
alter table public.import_discovered_files add column if not exists is_exam_relevant boolean default false;
alter table public.import_discovered_files add column if not exists relevance_category text default 'unknown';
alter table public.import_discovered_files add column if not exists relevance_reason text;
alter table public.import_discovered_files add column if not exists archived_at timestamp with time zone;

create table if not exists public.exam_file_texts (
  id uuid primary key default gen_random_uuid(),
  exam_file_id uuid references public.exam_files(id) on delete cascade,
  text_content text,
  page_count integer,
  extraction_status text default 'pending',
  extraction_error text,
  local_text_path text,
  extracted_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

alter table public.exam_file_texts add column if not exists exam_file_id uuid references public.exam_files(id) on delete cascade;
alter table public.exam_file_texts add column if not exists text_content text;
alter table public.exam_file_texts add column if not exists page_count integer;
alter table public.exam_file_texts add column if not exists extraction_status text default 'pending';
alter table public.exam_file_texts add column if not exists extraction_error text;
alter table public.exam_file_texts add column if not exists local_text_path text;
alter table public.exam_file_texts add column if not exists extracted_at timestamp with time zone;
alter table public.exam_file_texts add column if not exists created_at timestamp with time zone default now();

create table if not exists public.question_import_logs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_url text,
  status text default 'pending',
  message text,
  exams_found integer default 0,
  exams_imported integer default 0,
  exams_updated integer default 0,
  questions_found integer default 0,
  questions_imported integer default 0,
  questions_updated integer default 0,
  questions_skipped integer default 0,
  questions_needing_review integer default 0,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists public.question_parse_candidates (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references public.exams(id) on delete cascade,
  source_exam_file_id uuid references public.exam_files(id) on delete set null,
  source_gabarito_file_id uuid references public.exam_files(id) on delete set null,
  number integer,
  source_question_id text,
  statement text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  option_e text,
  correct_answer text,
  subject text,
  topic text,
  parse_status text default 'candidate',
  parse_confidence numeric default 0,
  parse_notes text,
  created_at timestamp with time zone default now()
);

create table if not exists public.import_run_reports (
  id uuid primary key default gen_random_uuid(),
  source_name text,
  run_type text,
  status text,
  message text,
  exams_found integer default 0,
  exams_imported integer default 0,
  pdfs_found integer default 0,
  pdfs_downloaded integer default 0,
  pdfs_blocked integer default 0,
  questions_candidates integer default 0,
  questions_imported integer default 0,
  questions_needing_review integer default 0,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

alter table public.exams enable row level security;
alter table public.questions enable row level security;
alter table public.study_sessions enable row level security;
alter table public.profiles enable row level security;
alter table public.question_attempts enable row level security;
alter table public.question_flags enable row level security;
alter table public.question_option_explanations enable row level security;
alter table public.study_materials enable row level security;
alter table public.import_sources enable row level security;
alter table public.exam_files enable row level security;
alter table public.import_jobs enable row level security;
alter table public.question_import_reviews enable row level security;
alter table public.import_discovered_files enable row level security;
alter table public.exam_file_texts enable row level security;
alter table public.question_import_logs enable row level security;
alter table public.question_parse_candidates enable row level security;
alter table public.import_run_reports enable row level security;

create or replace function public.get_my_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'student');
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.get_my_role() = 'admin';
$$;

grant execute on function public.get_my_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    'student'
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Usuarios nao podem alterar o proprio role.';
    end if;

    if new.email is distinct from old.email then
      raise exception 'Usuarios nao podem alterar o proprio email pelo profile.';
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists prevent_self_role_change_profiles on public.profiles;
create trigger prevent_self_role_change_profiles
before update on public.profiles
for each row execute function public.prevent_self_role_change();

drop policy if exists "Authenticated users can read exams" on public.exams;
create policy "Authenticated users can read exams"
on public.exams for select
to authenticated
using (true);

drop policy if exists "Authenticated users can manage exams" on public.exams;
create policy "Authenticated users can manage exams"
on public.exams for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can read questions" on public.questions;
create policy "Authenticated users can read questions"
on public.questions for select
to authenticated
using (true);

drop policy if exists "Authenticated users can manage questions" on public.questions;
create policy "Authenticated users can manage questions"
on public.questions for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can read study materials" on public.study_materials;
create policy "Authenticated users can read study materials"
on public.study_materials for select
to authenticated
using (true);

drop policy if exists "Authenticated users can manage study materials" on public.study_materials;
create policy "Authenticated users can manage study materials"
on public.study_materials for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can read import sources" on public.import_sources;
create policy "Authenticated users can read import sources"
on public.import_sources for select
to authenticated
using (true);

drop policy if exists "Authenticated users can manage import sources" on public.import_sources;
create policy "Authenticated users can manage import sources"
on public.import_sources for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can read exam files" on public.exam_files;
create policy "Authenticated users can read exam files"
on public.exam_files for select
to authenticated
using (true);

drop policy if exists "Authenticated users can manage exam files" on public.exam_files;
create policy "Authenticated users can manage exam files"
on public.exam_files for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can read import jobs" on public.import_jobs;
create policy "Authenticated users can read import jobs"
on public.import_jobs for select
to authenticated
using (true);

drop policy if exists "Authenticated users can manage import jobs" on public.import_jobs;
create policy "Authenticated users can manage import jobs"
on public.import_jobs for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can read question import reviews" on public.question_import_reviews;
create policy "Authenticated users can read question import reviews"
on public.question_import_reviews for select
to authenticated
using (true);

drop policy if exists "Authenticated users can manage question import reviews" on public.question_import_reviews;
create policy "Authenticated users can manage question import reviews"
on public.question_import_reviews for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can read import discovered files" on public.import_discovered_files;
create policy "Authenticated users can read import discovered files"
on public.import_discovered_files for select
to authenticated
using (true);

drop policy if exists "Authenticated users can manage import discovered files" on public.import_discovered_files;
create policy "Authenticated users can manage import discovered files"
on public.import_discovered_files for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can read exam file texts" on public.exam_file_texts;
create policy "Authenticated users can read exam file texts"
on public.exam_file_texts for select
to authenticated
using (true);

drop policy if exists "Authenticated users can manage exam file texts" on public.exam_file_texts;
create policy "Authenticated users can manage exam file texts"
on public.exam_file_texts for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can read question import logs" on public.question_import_logs;
create policy "Authenticated users can read question import logs"
on public.question_import_logs for select
to authenticated
using (true);

drop policy if exists "Authenticated users can manage question import logs" on public.question_import_logs;
create policy "Authenticated users can manage question import logs"
on public.question_import_logs for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can read question parse candidates" on public.question_parse_candidates;
create policy "Authenticated users can read question parse candidates"
on public.question_parse_candidates for select
to authenticated
using (true);

drop policy if exists "Authenticated users can manage question parse candidates" on public.question_parse_candidates;
create policy "Authenticated users can manage question parse candidates"
on public.question_parse_candidates for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can read import run reports" on public.import_run_reports;
create policy "Authenticated users can read import run reports"
on public.import_run_reports for select
to authenticated
using (true);

drop policy if exists "Authenticated users can manage import run reports" on public.import_run_reports;
create policy "Authenticated users can manage import run reports"
on public.import_run_reports for all
to authenticated
using (true)
with check (true);

drop policy if exists "Users can read own study sessions" on public.study_sessions;
create policy "Users can read own study sessions"
on public.study_sessions for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can create own study sessions" on public.study_sessions;
create policy "Users can create own study sessions"
on public.study_sessions for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own study sessions" on public.study_sessions;
create policy "Users can update own study sessions"
on public.study_sessions for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own study sessions" on public.study_sessions;
create policy "Users can delete own study sessions"
on public.study_sessions for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own question attempts" on public.question_attempts;
create policy "Users can read own question attempts"
on public.question_attempts for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create own question attempts" on public.question_attempts;
create policy "Users can create own question attempts"
on public.question_attempts for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own question attempts" on public.question_attempts;
create policy "Users can delete own question attempts"
on public.question_attempts for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own question flags" on public.question_flags;
create policy "Users can read own question flags"
on public.question_flags for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create own question flags" on public.question_flags;
create policy "Users can create own question flags"
on public.question_flags for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own question flags" on public.question_flags;
create policy "Users can update own question flags"
on public.question_flags for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own question flags" on public.question_flags;
create policy "Users can delete own question flags"
on public.question_flags for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Authenticated users can read question option explanations" on public.question_option_explanations;
create policy "Authenticated users can read question option explanations"
on public.question_option_explanations for select
to authenticated
using (true);

drop policy if exists "Authenticated users can manage question option explanations" on public.question_option_explanations;
create policy "Authenticated users can manage question option explanations"
on public.question_option_explanations for all
to authenticated
using (true)
with check (true);

create index if not exists idx_questions_exam_id on public.questions(exam_id);
create index if not exists idx_questions_filters on public.questions(discipline, subject);
create index if not exists idx_questions_discipline_topic on public.questions(discipline, topic);
create index if not exists idx_questions_classification_status on public.questions(classification_status);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_attempts_user_id on public.question_attempts(user_id);
create index if not exists idx_attempts_question_id on public.question_attempts(question_id);
create index if not exists idx_flags_user_id on public.question_flags(user_id);
create unique index if not exists idx_question_option_explanations_unique on public.question_option_explanations(question_id, option_key);
create index if not exists idx_question_option_explanations_question_id on public.question_option_explanations(question_id);
create unique index if not exists idx_import_sources_url_unique on public.import_sources(url);
create index if not exists idx_exam_files_exam_id on public.exam_files(exam_id);
create index if not exists idx_exam_files_source_name on public.exam_files(source_name);
create index if not exists idx_exam_files_type_status on public.exam_files(file_type, status);
create index if not exists idx_exam_files_extension on public.exam_files(file_extension);
create index if not exists idx_exam_files_processing_status on public.exam_files(processing_status);
create unique index if not exists idx_exam_files_exam_url_unique on public.exam_files(exam_id, url);
create index if not exists idx_import_jobs_source_id on public.import_jobs(source_id);
create index if not exists idx_question_import_reviews_question_id on public.question_import_reviews(question_id);
create index if not exists idx_study_materials_subject_topic_title on public.study_materials(subject, topic, title);
create unique index if not exists idx_import_discovered_files_url_unique on public.import_discovered_files(url);
create index if not exists idx_import_discovered_files_source_id on public.import_discovered_files(source_id);
create index if not exists idx_import_discovered_files_exam_id on public.import_discovered_files(exam_id);
create index if not exists idx_import_discovered_files_status on public.import_discovered_files(status);
create index if not exists idx_import_discovered_files_inferred_exam_id on public.import_discovered_files(inferred_exam_id);
create index if not exists idx_import_discovered_files_file_type on public.import_discovered_files(file_type);
create index if not exists idx_import_discovered_files_inferred_notice_number on public.import_discovered_files(inferred_notice_number);
create index if not exists idx_import_discovered_files_is_exam_relevant on public.import_discovered_files(is_exam_relevant);
create index if not exists idx_import_discovered_files_relevance_category on public.import_discovered_files(relevance_category);
create index if not exists idx_import_discovered_files_archived_at on public.import_discovered_files(archived_at);
create unique index if not exists idx_exam_file_texts_exam_file_id_unique on public.exam_file_texts(exam_file_id);
create index if not exists idx_exam_file_texts_extraction_status on public.exam_file_texts(extraction_status);
create index if not exists idx_exams_source_name on public.exams(source_name);
create index if not exists idx_exams_source_page_url on public.exams(source_page_url);
create index if not exists idx_exams_year_board_role on public.exams(year, board, role);
create index if not exists idx_questions_source_name on public.questions(source_name);
create index if not exists idx_questions_source_page_url on public.questions(source_page_url);
create index if not exists idx_questions_source_question_id on public.questions(source_question_id);
create index if not exists idx_questions_needs_review on public.questions(needs_review);
create index if not exists idx_questions_exam_id_phase4 on public.questions(exam_id);
create unique index if not exists idx_questions_source_question_unique on public.questions(source_name, source_question_id) where source_question_id is not null;
create index if not exists idx_question_parse_candidates_exam_id on public.question_parse_candidates(exam_id);
create index if not exists idx_question_parse_candidates_status on public.question_parse_candidates(parse_status);
create unique index if not exists idx_question_parse_candidates_unique
on public.question_parse_candidates(exam_id, number, statement)
where number is not null and statement is not null;
create index if not exists idx_import_run_reports_source_name on public.import_run_reports(source_name);
create index if not exists idx_import_run_reports_run_type on public.import_run_reports(run_type);
create index if not exists idx_import_run_reports_created_at on public.import_run_reports(created_at);
