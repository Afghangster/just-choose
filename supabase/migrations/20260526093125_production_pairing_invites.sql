create or replace function private.normalize_pairing_invite_code(invite_code_input text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select regexp_replace(upper(coalesce(invite_code_input, '')), '[^A-Z0-9]', '', 'g');
$$;

with ranked_pending_invites as (
  select
    id,
    row_number() over (
      partition by couple_id, created_by
      order by created_at desc
    ) as invite_rank
  from public.pairing_invites
  where status = 'pending'
)
update public.pairing_invites pi
set
  status = 'revoked',
  revoked_at = coalesce(pi.revoked_at, now())
from ranked_pending_invites ranked
where ranked.id = pi.id
  and ranked.invite_rank > 1;

create unique index if not exists pairing_invites_one_pending_per_creator_idx
on public.pairing_invites(couple_id, created_by)
where status = 'pending';

drop function if exists public.join_couple_by_invite(text);
drop function if exists public.accept_pairing_invite(text);
drop function if exists public.preview_pairing_invite(text);
drop function if exists public.create_pairing_invite();
drop function if exists private.join_couple_by_invite(text);
drop function if exists private.accept_pairing_invite(text);
drop function if exists private.preview_pairing_invite(text);
drop function if exists private.create_pairing_invite();
drop function if exists private.generate_pairing_invite_code();

create or replace function private.generate_pairing_invite_code()
returns text
language plpgsql
security definer
set search_path = public, private
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  generated_code text := '';
  byte_values bytea := gen_random_bytes(12);
  index integer;
begin
  for index in 0..11 loop
    generated_code := generated_code || substr(alphabet, (get_byte(byte_values, index) % length(alphabet)) + 1, 1);
  end loop;

  return generated_code;
end;
$$;

create or replace function private.create_pairing_invite()
returns table(couple_id uuid, code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  target_couple_id uuid;
  generated_code text;
  invite_expires_at timestamptz := now() + interval '1 hour';
begin
  if current_user_id is null then
    raise exception 'You need to sign in first.';
  end if;

  select cm.couple_id
  into target_couple_id
  from public.couple_members cm
  where cm.user_id = current_user_id
    and cm.status = 'accepted'
  order by cm.joined_at desc
  limit 1;

  if target_couple_id is not null and exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = target_couple_id
      and cm.user_id <> current_user_id
      and cm.status = 'accepted'
  ) then
    raise exception 'You are already paired.';
  end if;

  generated_code := private.generate_pairing_invite_code();

  while exists (select 1 from public.couples c where c.invite_code = generated_code)
    or exists (select 1 from public.pairing_invites pi where pi.code = generated_code)
  loop
    generated_code := private.generate_pairing_invite_code();
  end loop;

  if target_couple_id is null then
    insert into public.couples (
      invite_code,
      created_by,
      billing_owner_user_id,
      subscription_status,
      plan
    )
    values (
      generated_code,
      current_user_id,
      null,
      'inactive',
      'free'
    )
    returning id into target_couple_id;

    insert into public.couple_members (
      couple_id,
      user_id,
      role,
      status,
      invited_by,
      accepted_at
    )
    values (
      target_couple_id,
      current_user_id,
      'owner',
      'accepted',
      current_user_id,
      now()
    )
    on conflict (couple_id, user_id) do update
    set
      role = 'owner',
      status = 'accepted',
      invited_by = excluded.invited_by,
      accepted_at = now();
  else
    update public.pairing_invites pi
    set
      status = 'revoked',
      revoked_at = now()
    where pi.couple_id = target_couple_id
      and pi.created_by = current_user_id
      and pi.status = 'pending';

    update public.couples c
    set invite_code = generated_code
    where c.id = target_couple_id;
  end if;

  return query
  insert into public.pairing_invites (
    couple_id,
    code,
    created_by,
    status,
    max_uses,
    use_count,
    expires_at
  )
  values (
    target_couple_id,
    generated_code,
    current_user_id,
    'pending',
    1,
    0,
    invite_expires_at
  )
  returning pairing_invites.couple_id, pairing_invites.code, pairing_invites.expires_at;
end;
$$;

create or replace function private.preview_pairing_invite(invite_code_input text)
returns table(code text, inviter_display_name text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_code text := private.normalize_pairing_invite_code(invite_code_input);
  target_invite public.pairing_invites%rowtype;
  existing_couple_id uuid;
begin
  if current_user_id is null then
    raise exception 'You need to sign in first.';
  end if;

  if normalized_code = '' then
    raise exception 'Enter an invite code.';
  end if;

  update public.pairing_invites pi
  set status = 'expired'
  where pi.code = normalized_code
    and pi.status = 'pending'
    and pi.expires_at <= now();

  select *
  into target_invite
  from public.pairing_invites pi
  where pi.code = normalized_code
    and pi.status = 'pending'
    and pi.expires_at > now()
    and pi.use_count < pi.max_uses
  order by pi.created_at desc
  limit 1;

  if target_invite.id is null then
    raise exception 'Invite code not found or expired.';
  end if;

  if target_invite.created_by = current_user_id then
    raise exception 'You cannot accept your own invite.';
  end if;

  select cm.couple_id
  into existing_couple_id
  from public.couple_members cm
  where cm.user_id = current_user_id
    and cm.status = 'accepted'
  limit 1;

  if existing_couple_id is not null and existing_couple_id <> target_invite.couple_id then
    raise exception 'You are already paired.';
  end if;

  return query
  select
    target_invite.code,
    p.display_name,
    target_invite.expires_at
  from public.profiles p
  where p.id = target_invite.created_by;
end;
$$;

create or replace function private.accept_pairing_invite(invite_code_input text)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_code text := private.normalize_pairing_invite_code(invite_code_input);
  target_invite public.pairing_invites%rowtype;
  existing_couple_id uuid;
begin
  if current_user_id is null then
    raise exception 'You need to sign in first.';
  end if;

  if normalized_code = '' then
    raise exception 'Enter an invite code.';
  end if;

  update public.pairing_invites pi
  set status = 'expired'
  where pi.code = normalized_code
    and pi.status = 'pending'
    and pi.expires_at <= now();

  select *
  into target_invite
  from public.pairing_invites pi
  where pi.code = normalized_code
    and pi.status = 'pending'
    and pi.expires_at > now()
    and pi.use_count < pi.max_uses
  order by pi.created_at desc
  limit 1
  for update;

  if target_invite.id is null then
    raise exception 'Invite code not found or expired.';
  end if;

  if target_invite.created_by = current_user_id then
    raise exception 'You cannot accept your own invite.';
  end if;

  select cm.couple_id
  into existing_couple_id
  from public.couple_members cm
  where cm.user_id = current_user_id
    and cm.status = 'accepted'
  limit 1;

  if existing_couple_id is not null and existing_couple_id <> target_invite.couple_id then
    raise exception 'You are already paired.';
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

  update public.pairing_invites pi
  set
    status = 'accepted',
    accepted_by = current_user_id,
    accepted_at = now(),
    use_count = pi.use_count + 1
  where pi.id = target_invite.id;

  return target_invite.couple_id;
end;
$$;

create or replace function private.join_couple_by_invite(invite_code_input text)
returns uuid
language sql
security definer
set search_path = public, private
as $$
  select private.accept_pairing_invite(invite_code_input);
$$;

create or replace function public.create_pairing_invite()
returns table(couple_id uuid, code text, expires_at timestamptz)
language sql
security invoker
set search_path = public, private
as $$
  select * from private.create_pairing_invite();
$$;

create or replace function public.preview_pairing_invite(invite_code_input text)
returns table(code text, inviter_display_name text, expires_at timestamptz)
language sql
security invoker
set search_path = public, private
as $$
  select * from private.preview_pairing_invite(invite_code_input);
$$;

create or replace function public.accept_pairing_invite(invite_code_input text)
returns uuid
language sql
security invoker
set search_path = public, private
as $$
  select private.accept_pairing_invite(invite_code_input);
$$;

create or replace function public.join_couple_by_invite(invite_code_input text)
returns uuid
language sql
security invoker
set search_path = public, private
as $$
  select private.accept_pairing_invite(invite_code_input);
$$;

grant execute on function private.normalize_pairing_invite_code(text) to authenticated;
grant execute on function private.generate_pairing_invite_code() to authenticated;
grant execute on function private.create_pairing_invite() to authenticated;
grant execute on function private.preview_pairing_invite(text) to authenticated;
grant execute on function private.accept_pairing_invite(text) to authenticated;
grant execute on function private.join_couple_by_invite(text) to authenticated;
grant execute on function public.create_pairing_invite() to authenticated;
grant execute on function public.preview_pairing_invite(text) to authenticated;
grant execute on function public.accept_pairing_invite(text) to authenticated;
grant execute on function public.join_couple_by_invite(text) to authenticated;
