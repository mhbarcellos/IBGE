create table if not exists public.simulated_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text,
  focus text,
  total_questions integer,
  correct_count integer default 0,
  wrong_count integer default 0,
  started_at timestamp with time zone default now(),
  finished_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists public.simulated_exam_questions (
  id uuid primary key default gen_random_uuid(),
  simulated_exam_id uuid references public.simulated_exams(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  question_order integer,
  selected_answer text,
  is_correct boolean,
  answered_at timestamp with time zone
);

alter table public.simulated_exams enable row level security;
alter table public.simulated_exam_questions enable row level security;

drop policy if exists "Users can read own simulated exams" on public.simulated_exams;
create policy "Users can read own simulated exams"
on public.simulated_exams for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create own simulated exams" on public.simulated_exams;
create policy "Users can create own simulated exams"
on public.simulated_exams for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own simulated exams" on public.simulated_exams;
create policy "Users can update own simulated exams"
on public.simulated_exams for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own simulated exams" on public.simulated_exams;
create policy "Users can delete own simulated exams"
on public.simulated_exams for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own simulated exam questions" on public.simulated_exam_questions;
create policy "Users can read own simulated exam questions"
on public.simulated_exam_questions for select
to authenticated
using (
  exists (
    select 1
    from public.simulated_exams se
    where se.id = simulated_exam_id
      and se.user_id = auth.uid()
  )
);

drop policy if exists "Users can create own simulated exam questions" on public.simulated_exam_questions;
create policy "Users can create own simulated exam questions"
on public.simulated_exam_questions for insert
to authenticated
with check (
  exists (
    select 1
    from public.simulated_exams se
    where se.id = simulated_exam_id
      and se.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own simulated exam questions" on public.simulated_exam_questions;
create policy "Users can update own simulated exam questions"
on public.simulated_exam_questions for update
to authenticated
using (
  exists (
    select 1
    from public.simulated_exams se
    where se.id = simulated_exam_id
      and se.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.simulated_exams se
    where se.id = simulated_exam_id
      and se.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own simulated exam questions" on public.simulated_exam_questions;
create policy "Users can delete own simulated exam questions"
on public.simulated_exam_questions for delete
to authenticated
using (
  exists (
    select 1
    from public.simulated_exams se
    where se.id = simulated_exam_id
      and se.user_id = auth.uid()
  )
);

create index if not exists idx_simulated_exams_user_id on public.simulated_exams(user_id);
create index if not exists idx_simulated_exams_created_at on public.simulated_exams(created_at);
create index if not exists idx_simulated_exam_questions_exam_id on public.simulated_exam_questions(simulated_exam_id);
create index if not exists idx_simulated_exam_questions_question_id on public.simulated_exam_questions(question_id);
