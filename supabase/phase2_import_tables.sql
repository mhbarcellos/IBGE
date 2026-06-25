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

alter table public.import_sources enable row level security;
alter table public.exam_files enable row level security;
alter table public.import_jobs enable row level security;
alter table public.question_import_reviews enable row level security;

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

create unique index if not exists idx_import_sources_url_unique on public.import_sources(url);
create index if not exists idx_exam_files_exam_id on public.exam_files(exam_id);
create index if not exists idx_import_jobs_source_id on public.import_jobs(source_id);
create index if not exists idx_question_import_reviews_question_id on public.question_import_reviews(question_id);
create index if not exists idx_study_materials_subject_topic_title on public.study_materials(subject, topic, title);
