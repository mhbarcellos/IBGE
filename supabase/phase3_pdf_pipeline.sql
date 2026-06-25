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
  status text default 'discovered',
  notes text,
  created_at timestamp with time zone default now()
);

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

alter table public.import_discovered_files enable row level security;
alter table public.exam_file_texts enable row level security;

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

create unique index if not exists idx_import_discovered_files_url_unique on public.import_discovered_files(url);
create index if not exists idx_import_discovered_files_source_id on public.import_discovered_files(source_id);
create index if not exists idx_import_discovered_files_exam_id on public.import_discovered_files(exam_id);
create index if not exists idx_import_discovered_files_status on public.import_discovered_files(status);
create unique index if not exists idx_exam_file_texts_exam_file_id_unique on public.exam_file_texts(exam_file_id);
create index if not exists idx_exam_file_texts_extraction_status on public.exam_file_texts(extraction_status);
