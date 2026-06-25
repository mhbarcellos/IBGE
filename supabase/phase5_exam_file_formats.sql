alter table public.exam_files add column if not exists file_extension text;
alter table public.exam_files add column if not exists mime_type text;
alter table public.exam_files add column if not exists processing_status text default 'pending';
alter table public.exam_files add column if not exists processing_error text;
alter table public.exam_files add column if not exists is_processable boolean default true;

create index if not exists idx_exam_files_extension on public.exam_files(file_extension);
create index if not exists idx_exam_files_processing_status on public.exam_files(processing_status);
