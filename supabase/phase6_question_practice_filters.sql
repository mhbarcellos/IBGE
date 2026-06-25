alter table public.questions add column if not exists discipline text;
alter table public.questions add column if not exists topic text;
alter table public.questions add column if not exists classification_status text default 'unclassified';
alter table public.questions add column if not exists classification_source text;
alter table public.questions add column if not exists classification_updated_at timestamp with time zone;

update public.questions
set
  discipline = coalesce(nullif(discipline, ''), 'Nao classificada'),
  topic = coalesce(nullif(topic, ''), nullif(subject, ''), 'Nao classificado'),
  classification_status = coalesce(classification_status, 'unclassified')
where discipline is null
  or discipline = ''
  or topic is null
  or topic = ''
  or classification_status is null;

create index if not exists idx_questions_discipline_topic on public.questions(discipline, topic);
create index if not exists idx_questions_classification_status on public.questions(classification_status);
