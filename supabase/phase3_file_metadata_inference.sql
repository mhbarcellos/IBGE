alter table public.import_discovered_files add column if not exists normalized_title text;
alter table public.import_discovered_files add column if not exists inferred_notice_number text;
alter table public.import_discovered_files add column if not exists inferred_exam_title text;
alter table public.import_discovered_files add column if not exists inferred_exam_id uuid references public.exams(id) on delete set null;
alter table public.import_discovered_files add column if not exists inference_confidence numeric default 0;
alter table public.import_discovered_files add column if not exists inference_notes text;

create index if not exists idx_import_discovered_files_inferred_exam_id on public.import_discovered_files(inferred_exam_id);
create index if not exists idx_import_discovered_files_file_type on public.import_discovered_files(file_type);
create index if not exists idx_import_discovered_files_inferred_notice_number on public.import_discovered_files(inferred_notice_number);
