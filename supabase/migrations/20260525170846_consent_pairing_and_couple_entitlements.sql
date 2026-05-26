alter table public.couples
  add column if not exists billing_owner_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists subscription_status text not null default 'inactive',
  add column if not exists plan text not null default 'free',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_current_period_end timestamptz;

alter table public.couples
  drop constraint if exists couples_subscription_status_check,
  add constraint couples_subscription_status_check check (
    subscription_status in ('inactive', 'trialing', 'active', 'past_due', 'canceled')
  );

alter table public.couple_members
  add column if not exists status text not null default 'accepted',
  add column if not exists invited_by uuid references public.profiles(id) on delete set null,
  add column if not exists accepted_at timestamptz;

update public.couple_members
set
  status = coalesce(status, 'accepted'),
  accepted_at = coalesce(accepted_at, joined_at);

alter table public.couple_members
  drop constraint if exists couple_members_status_check,
  add constraint couple_members_status_check check (
    status in ('invited', 'accepted', 'declined', 'removed')
  );

create unique index if not exists couple_members_one_accepted_couple_per_user_idx
on public.couple_members(user_id)
where status = 'accepted';

create table if not exists public.pairing_invites (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  accepted_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending',
  max_uses integer not null default 1,
  use_count integer not null default 0,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pairing_invites_status_check check (
    status in ('pending', 'accepted', 'expired', 'revoked')
  ),
  constraint pairing_invites_max_uses_check check (max_uses > 0),
  constraint pairing_invites_use_count_check check (use_count >= 0 and use_count <= max_uses)
);

create index if not exists pairing_invites_couple_id_idx
on public.pairing_invites(couple_id);

create index if not exists pairing_invites_code_pending_idx
on public.pairing_invites(code)
where status = 'pending';

drop trigger if exists pairing_invites_set_updated_at on public.pairing_invites;
create trigger pairing_invites_set_updated_at
before update on public.pairing_invites
for each row execute function public.set_updated_at();

alter table public.pairing_invites enable row level security;

create or replace function private.is_couple_member(target_couple_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = target_couple_id
      and cm.user_id = (select auth.uid())
      and cm.status = 'accepted'
  );
$$;

drop policy if exists "Users can join a couple as themselves" on public.couple_members;

create policy "Couple creators can add their accepted owner membership"
on public.couple_members for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'accepted'
  and exists (
    select 1
    from public.couples c
    where c.id = couple_id
      and c.created_by = (select auth.uid())
  )
);

drop policy if exists "Users can read profiles in their couples" on public.profiles;

create policy "Users can read profiles in accepted couples"
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.couple_members mine
    join public.couple_members theirs
      on theirs.couple_id = mine.couple_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'accepted'
      and theirs.status = 'accepted'
      and theirs.user_id = profiles.id
  )
);

create policy "Members can read pairing invites in their couple"
on public.pairing_invites for select
to authenticated
using (private.is_couple_member(couple_id));

create policy "Members can create pairing invites for their couple"
on public.pairing_invites for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and status = 'pending'
  and private.is_couple_member(couple_id)
);

create policy "Invite creators can revoke pending pairing invites"
on public.pairing_invites for update
to authenticated
using (
  created_by = (select auth.uid())
  and status = 'pending'
  and private.is_couple_member(couple_id)
)
with check (
  created_by = (select auth.uid())
  and status in ('pending', 'revoked')
  and private.is_couple_member(couple_id)
);

drop function if exists public.join_couple_by_invite(text);
drop function if exists private.join_couple_by_invite(text);

create or replace function private.join_couple_by_invite(invite_code_input text)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  target_invite public.pairing_invites%rowtype;
begin
  if current_user_id is null then
    raise exception 'You need to sign in first.';
  end if;

  select *
  into target_invite
  from public.pairing_invites
  where code = upper(trim(invite_code_input))
    and status = 'pending'
    and expires_at > now()
    and use_count < max_uses
  order by created_at desc
  limit 1
  for update;

  if target_invite.id is null then
    raise exception 'Invite code not found or expired.';
  end if;

  if target_invite.created_by = current_user_id then
    raise exception 'You cannot accept your own invite.';
  end if;

  insert into public.couple_members (
    couple_id,
    user_id,
    role,
    status,
    invited_by,
    accepted_at
  )
  values (
    target_invite.couple_id,
    current_user_id,
    'partner',
    'accepted',
    target_invite.created_by,
    now()
  )
  on conflict (couple_id, user_id) do update
  set
    status = 'accepted',
    role = excluded.role,
    invited_by = excluded.invited_by,
    accepted_at = now();

  update public.pairing_invites
  set
    status = 'accepted',
    accepted_by = current_user_id,
    accepted_at = now(),
    use_count = use_count + 1
  where id = target_invite.id;

  return target_invite.couple_id;
end;
$$;

create or replace function public.join_couple_by_invite(invite_code_input text)
returns uuid
language sql
security invoker
set search_path = public, private
as $$
  select private.join_couple_by_invite(invite_code_input);
$$;

grant select, insert, update on public.pairing_invites to authenticated;
grant select, insert, update on public.couples to authenticated;
grant select, insert, update, delete on public.couple_members to authenticated;
grant execute on function private.join_couple_by_invite(text) to authenticated;
grant execute on function public.join_couple_by_invite(text) to authenticated;
