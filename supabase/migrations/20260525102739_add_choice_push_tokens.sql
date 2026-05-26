create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index push_tokens_user_id_idx on public.push_tokens(user_id);

create trigger push_tokens_set_updated_at
before update on public.push_tokens
for each row execute function public.set_updated_at();

alter table public.push_tokens enable row level security;

create policy "Users can read own and partner push tokens"
on public.push_tokens for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.couple_members mine
    join public.couple_members theirs
      on theirs.couple_id = mine.couple_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = push_tokens.user_id
  )
);

create policy "Users can create their own push tokens"
on public.push_tokens for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their own push tokens"
on public.push_tokens for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can delete their own push tokens"
on public.push_tokens for delete
to authenticated
using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.push_tokens to authenticated;
