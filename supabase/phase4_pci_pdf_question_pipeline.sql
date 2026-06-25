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
alter table public.exam_files add column if not exists created_at timestamp with time zone default now();

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

alter table public.question_parse_candidates enable row level security;

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

create index if not exists idx_exam_files_exam_id on public.exam_files(exam_id);
create index if not exists idx_exam_files_source_name on public.exam_files(source_name);
create index if not exists idx_exam_files_type_status on public.exam_files(file_type, status);
create unique index if not exists idx_exam_files_exam_url_unique on public.exam_files(exam_id, url);

create unique index if not exists idx_exam_file_texts_exam_file_id_unique on public.exam_file_texts(exam_file_id);
create index if not exists idx_exam_file_texts_extraction_status on public.exam_file_texts(extraction_status);

create index if not exists idx_question_parse_candidates_exam_id on public.question_parse_candidates(exam_id);
create index if not exists idx_question_parse_candidates_status on public.question_parse_candidates(parse_status);
create unique index if not exists idx_question_parse_candidates_unique
on public.question_parse_candidates(exam_id, number, statement)
where number is not null and statement is not null;
