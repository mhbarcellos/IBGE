alter table public.exams add column if not exists role_focus text default 'unknown';
alter table public.exams add column if not exists target_role text;
alter table public.exams add column if not exists role_alias_matched text;

alter table public.questions add column if not exists role_focus text default 'unknown';
alter table public.questions add column if not exists target_role text;

alter table public.study_materials add column if not exists target_role text;
alter table public.study_materials add column if not exists role_focus text default 'unknown';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'exams_role_focus_check'
      and conrelid = 'public.exams'::regclass
  ) then
    alter table public.exams
    add constraint exams_role_focus_check
    check (role_focus in ('target', 'related', 'other', 'unknown'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'questions_role_focus_check'
      and conrelid = 'public.questions'::regclass
  ) then
    alter table public.questions
    add constraint questions_role_focus_check
    check (role_focus in ('target', 'related', 'other', 'unknown'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'study_materials_role_focus_check'
      and conrelid = 'public.study_materials'::regclass
  ) then
    alter table public.study_materials
    add constraint study_materials_role_focus_check
    check (role_focus in ('target', 'related', 'other', 'unknown'));
  end if;
end $$;

create index if not exists idx_exams_role_focus on public.exams(role_focus);
create index if not exists idx_exams_target_role on public.exams(target_role);
create index if not exists idx_questions_role_focus on public.questions(role_focus);
create index if not exists idx_questions_target_role on public.questions(target_role);
create index if not exists idx_study_materials_role_focus on public.study_materials(role_focus);
create index if not exists idx_study_materials_target_role on public.study_materials(target_role);
