alter table public.questions add column if not exists explanation text;
alter table public.questions add column if not exists explanation_status text default 'missing';
alter table public.questions add column if not exists explanation_source text;
alter table public.questions add column if not exists explanation_updated_at timestamp with time zone;

update public.questions
set explanation_status = case
  when explanation is null or trim(explanation) = '' then 'missing'
  when explanation_status is null or explanation_status = 'missing' then 'reviewed'
  else explanation_status
end
where explanation_status is null
  or explanation_status = 'missing';

create table if not exists public.question_option_explanations (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references public.questions(id) on delete cascade,
  option_key text not null,
  explanation text not null,
  explanation_status text default 'missing',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.question_option_explanations enable row level security;

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

create unique index if not exists idx_question_option_explanations_unique
on public.question_option_explanations(question_id, option_key);

create index if not exists idx_question_option_explanations_question_id
on public.question_option_explanations(question_id);
