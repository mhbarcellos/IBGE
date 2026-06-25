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

alter table public.questions alter column correct_answer drop not null;

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

alter table public.question_import_logs enable row level security;

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

create index if not exists idx_exams_source_name on public.exams(source_name);
create index if not exists idx_exams_source_page_url on public.exams(source_page_url);
create index if not exists idx_exams_year_board_role on public.exams(year, board, role);
create index if not exists idx_questions_source_name on public.questions(source_name);
create index if not exists idx_questions_source_page_url on public.questions(source_page_url);
create index if not exists idx_questions_source_question_id on public.questions(source_question_id);
create index if not exists idx_questions_needs_review on public.questions(needs_review);
create index if not exists idx_questions_exam_id_phase4 on public.questions(exam_id);
create unique index if not exists idx_questions_source_question_unique
on public.questions(source_name, source_question_id)
where source_question_id is not null;
