create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

create or replace function public.get_my_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'student');
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.get_my_role() = 'admin';
$$;

grant execute on function public.get_my_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    'student'
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Usuarios nao podem alterar o proprio role.';
    end if;

    if new.email is distinct from old.email then
      raise exception 'Usuarios nao podem alterar o proprio email pelo profile.';
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists prevent_self_role_change_profiles on public.profiles;
create trigger prevent_self_role_change_profiles
before update on public.profiles
for each row execute function public.prevent_self_role_change();

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.profiles (id, email, full_name, role)
select id, email, raw_user_meta_data->>'full_name', 'student'
from auth.users
on conflict (id) do nothing;

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);
