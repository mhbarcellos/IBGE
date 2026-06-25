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

alter table public.import_run_reports enable row level security;

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

create index if not exists idx_import_run_reports_source_name on public.import_run_reports(source_name);
create index if not exists idx_import_run_reports_run_type on public.import_run_reports(run_type);
create index if not exists idx_import_run_reports_created_at on public.import_run_reports(created_at);
