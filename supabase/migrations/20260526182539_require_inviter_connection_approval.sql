drop function if exists public.join_connection_by_invite(text);
drop function if exists public.accept_connection_invite(text);
drop function if exists public.pending_connection_requests();
drop function if exists public.approve_connection_request(uuid);
drop function if exists public.reject_connection_request(uuid);
drop function if exists private.join_connection_by_invite(text);
drop function if exists private.accept_connection_invite(text);
drop function if exists private.pending_connection_requests();
drop function if exists private.approve_connection_request(uuid);
drop function if exists private.reject_connection_request(uuid);

create or replace function private.accept_connection_invite(invite_code_input text)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_code text := private.normalize_connection_invite_code(invite_code_input);
  target_invite public.connection_invites%rowtype;
  existing_membership public.connection_members%rowtype;
begin
  if current_user_id is null then
    raise exception 'You need to sign in first.';
  end if;

  if normalized_code = '' then
    raise exception 'Enter an invite code.';
  end if;

  update public.connection_invites ci
  set status = 'expired'
  where ci.code = normalized_code
    and ci.status = 'pending'
    and ci.expires_at <= now();

  select *
  into target_invite
  from public.connection_invites ci
  where ci.code = normalized_code
    and ci.status = 'pending'
    and ci.expires_at > now()
    and ci.use_count < ci.max_uses
  order by ci.created_at desc
  limit 1
  for update;

  if target_invite.id is null then
    raise exception 'Invite code not found or expired.';
  end if;

  if target_invite.created_by = current_user_id then
    raise exception 'You cannot accept your own invite.';
  end if;

  select *
  into existing_membership
  from public.connection_members cm
  where cm.user_id = current_user_id
    and cm.status in ('invited', 'accepted')
  order by cm.joined_at desc
  limit 1;

  if existing_membership.id is not null and existing_membership.connection_id <> target_invite.connection_id then
    if existing_membership.status = 'accepted' then
      raise exception 'You already have an accepted connection.';
    end if;
    raise exception 'You already have a pending connection request.';
  end if;

  if existing_membership.id is not null and existing_membership.status = 'accepted' then
    return target_invite.connection_id;
  end if;

  insert into public.connection_members (
    connection_id,
    user_id,
    role,
    status,
    invited_by,
    accepted_at
  )
  values (
    target_invite.connection_id,
    current_user_id,
    'member',
    'invited',
    target_invite.created_by,
    null
  )
  on conflict (connection_id, user_id) do update
  set
    status = 'invited',
    role = excluded.role,
    invited_by = excluded.invited_by,
    accepted_at = null;

  update public.connection_invites ci
  set
    status = 'accepted',
    accepted_by = current_user_id,
    accepted_at = now(),
    use_count = ci.use_count + 1
  where ci.id = target_invite.id;

  return target_invite.connection_id;
end;
$$;

create or replace function private.pending_connection_requests()
returns table(connection_id uuid, requester_id uuid, requester_display_name text, requested_at timestamptz)
language sql
security definer
set search_path = public, private
as $$
  select
    cm.connection_id,
    cm.user_id as requester_id,
    p.display_name as requester_display_name,
    cm.joined_at as requested_at
  from public.connection_members owner
  join public.connections c
    on c.id = owner.connection_id
  join public.connection_members cm
    on cm.connection_id = owner.connection_id
  join public.profiles p
    on p.id = cm.user_id
  where owner.user_id = auth.uid()
    and owner.status = 'accepted'
    and c.created_by = auth.uid()
    and cm.status = 'invited'
    and cm.user_id <> auth.uid()
    and not exists (
      select 1
      from public.connection_members accepted_partner
      where accepted_partner.connection_id = owner.connection_id
        and accepted_partner.status = 'accepted'
        and accepted_partner.user_id <> auth.uid()
    )
  order by cm.joined_at asc;
$$;

create or replace function private.approve_connection_request(requester_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  target_connection_id uuid;
begin
  if current_user_id is null then
    raise exception 'You need to sign in first.';
  end if;

  select cm.connection_id
  into target_connection_id
  from public.connection_members cm
  join public.connections c
    on c.id = cm.connection_id
  join public.connection_members owner
    on owner.connection_id = cm.connection_id
  where cm.user_id = requester_user_id
    and cm.status = 'invited'
    and c.created_by = current_user_id
    and owner.user_id = current_user_id
    and owner.status = 'accepted'
  limit 1
  for update of cm;

  if target_connection_id is null then
    raise exception 'Connection request not found.';
  end if;

  if exists (
    select 1
    from public.connection_members accepted_partner
    where accepted_partner.connection_id = target_connection_id
      and accepted_partner.user_id <> current_user_id
      and accepted_partner.status = 'accepted'
  ) then
    raise exception 'You already have an accepted connection.';
  end if;

  update public.connection_members cm
  set
    status = 'accepted',
    accepted_at = now()
  where cm.connection_id = target_connection_id
    and cm.user_id = requester_user_id
    and cm.status = 'invited';

  update public.connection_members cm
  set status = 'declined'
  where cm.connection_id = target_connection_id
    and cm.user_id <> requester_user_id
    and cm.user_id <> current_user_id
    and cm.status = 'invited';

  return target_connection_id;
end;
$$;

create or replace function private.reject_connection_request(requester_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  target_connection_id uuid;
begin
  if current_user_id is null then
    raise exception 'You need to sign in first.';
  end if;

  select cm.connection_id
  into target_connection_id
  from public.connection_members cm
  join public.connections c
    on c.id = cm.connection_id
  join public.connection_members owner
    on owner.connection_id = cm.connection_id
  where cm.user_id = requester_user_id
    and cm.status = 'invited'
    and c.created_by = current_user_id
    and owner.user_id = current_user_id
    and owner.status = 'accepted'
  limit 1
  for update of cm;

  if target_connection_id is null then
    raise exception 'Connection request not found.';
  end if;

  update public.connection_members cm
  set status = 'declined'
  where cm.connection_id = target_connection_id
    and cm.user_id = requester_user_id
    and cm.status = 'invited';

  return target_connection_id;
end;
$$;

create or replace function private.join_connection_by_invite(invite_code_input text)
returns uuid
language sql
security definer
set search_path = public, private
as $$
  select private.accept_connection_invite(invite_code_input);
$$;

create or replace function public.accept_connection_invite(invite_code_input text)
returns uuid
language sql
security definer
set search_path = public, private
as $$
  select private.accept_connection_invite(invite_code_input);
$$;

create or replace function public.join_connection_by_invite(invite_code_input text)
returns uuid
language sql
security definer
set search_path = public, private
as $$
  select private.accept_connection_invite(invite_code_input);
$$;

create or replace function public.pending_connection_requests()
returns table(connection_id uuid, requester_id uuid, requester_display_name text, requested_at timestamptz)
language sql
security definer
set search_path = public, private
as $$
  select * from private.pending_connection_requests();
$$;

create or replace function public.approve_connection_request(requester_user_id uuid)
returns uuid
language sql
security definer
set search_path = public, private
as $$
  select private.approve_connection_request(requester_user_id);
$$;

create or replace function public.reject_connection_request(requester_user_id uuid)
returns uuid
language sql
security definer
set search_path = public, private
as $$
  select private.reject_connection_request(requester_user_id);
$$;

grant execute on function private.accept_connection_invite(text) to authenticated;
grant execute on function private.join_connection_by_invite(text) to authenticated;
grant execute on function private.pending_connection_requests() to authenticated;
grant execute on function private.approve_connection_request(uuid) to authenticated;
grant execute on function private.reject_connection_request(uuid) to authenticated;
grant execute on function public.accept_connection_invite(text) to authenticated;
grant execute on function public.join_connection_by_invite(text) to authenticated;
grant execute on function public.pending_connection_requests() to authenticated;
grant execute on function public.approve_connection_request(uuid) to authenticated;
grant execute on function public.reject_connection_request(uuid) to authenticated;
