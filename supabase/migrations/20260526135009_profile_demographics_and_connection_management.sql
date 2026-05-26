alter table public.profiles
  add column if not exists age integer,
  add column if not exists gender text;

alter table public.profiles
  drop constraint if exists profiles_age_check,
  add constraint profiles_age_check check (age is null or (age >= 13 and age <= 120));

alter table public.profiles
  drop constraint if exists profiles_gender_check,
  add constraint profiles_gender_check check (
    gender is null
    or gender in ('woman', 'man', 'non_binary', 'prefer_not_to_say', 'self_describe')
  );

create table if not exists public.connection_aliases (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, owner_user_id, target_user_id),
  constraint connection_aliases_display_name_check check (char_length(trim(display_name)) between 1 and 40),
  constraint connection_aliases_not_self_check check (owner_user_id <> target_user_id)
);

drop trigger if exists connection_aliases_set_updated_at on public.connection_aliases;
create trigger connection_aliases_set_updated_at
before update on public.connection_aliases
for each row execute function public.set_updated_at();

alter table public.connection_aliases enable row level security;

drop policy if exists "Users can read their connection aliases" on public.connection_aliases;
create policy "Users can read their connection aliases"
on public.connection_aliases for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  and private.is_connection_member(connection_id)
);

drop policy if exists "Users can create their connection aliases" on public.connection_aliases;
create policy "Users can create their connection aliases"
on public.connection_aliases for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and private.is_connection_member(connection_id)
  and exists (
    select 1
    from public.connection_members cm
    where cm.connection_id = connection_aliases.connection_id
      and cm.user_id = connection_aliases.target_user_id
      and cm.status = 'accepted'
  )
);

drop policy if exists "Users can update their connection aliases" on public.connection_aliases;
create policy "Users can update their connection aliases"
on public.connection_aliases for update
to authenticated
using (
  owner_user_id = (select auth.uid())
  and private.is_connection_member(connection_id)
)
with check (
  owner_user_id = (select auth.uid())
  and private.is_connection_member(connection_id)
);

drop policy if exists "Users can delete their connection aliases" on public.connection_aliases;
create policy "Users can delete their connection aliases"
on public.connection_aliases for delete
to authenticated
using (
  owner_user_id = (select auth.uid())
  and private.is_connection_member(connection_id)
);

create or replace function private.stop_connection(target_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'You need to sign in first.';
  end if;

  if not exists (
    select 1
    from public.connection_members cm
    where cm.connection_id = target_connection_id
      and cm.user_id = auth.uid()
      and cm.status = 'accepted'
  ) then
    raise exception 'Connection not found.';
  end if;

  update public.connection_invites ci
  set
    status = 'revoked',
    revoked_at = coalesce(ci.revoked_at, now())
  where ci.connection_id = target_connection_id
    and ci.status = 'pending';

  update public.connection_members cm
  set status = 'removed'
  where cm.connection_id = target_connection_id
    and cm.status = 'accepted';
end;
$$;

create or replace function public.stop_connection(target_connection_id uuid)
returns void
language sql
security invoker
set search_path = public, private
as $$
  select private.stop_connection(target_connection_id);
$$;

grant select, insert, update, delete on public.connection_aliases to authenticated;
grant execute on function private.stop_connection(uuid) to authenticated;
grant execute on function public.stop_connection(uuid) to authenticated;
