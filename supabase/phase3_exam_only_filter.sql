alter table public.import_discovered_files add column if not exists is_exam_relevant boolean default false;
alter table public.import_discovered_files add column if not exists relevance_category text default 'unknown';
alter table public.import_discovered_files add column if not exists relevance_reason text;
alter table public.import_discovered_files add column if not exists archived_at timestamp with time zone;

create index if not exists idx_import_discovered_files_is_exam_relevant on public.import_discovered_files(is_exam_relevant);
create index if not exists idx_import_discovered_files_relevance_category on public.import_discovered_files(relevance_category);
create index if not exists idx_import_discovered_files_archived_at on public.import_discovered_files(archived_at);
