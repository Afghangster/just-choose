drop index if exists public.connection_members_one_accepted_connection_per_user_idx;

alter table if exists public.connection_aliases
  drop column if exists avatar_url,
  drop column if exists avatar_path;

drop function if exists public.create_connection_invite();
drop function if exists private.create_connection_invite();

create or replace function private.create_connection_invite()
returns table(created_connection_id uuid, invite_code text, invite_expires_at timestamptz)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  target_connection_id uuid;
  latest_pending_invite_created_at timestamptz;
  generated_code text;
  expires_at_value timestamptz := now() + interval '1 hour';
begin
  if current_user_id is null then
    raise exception 'You need to sign in first.';
  end if;

  select ci.created_at
  into latest_pending_invite_created_at
  from public.connection_invites ci
  where ci.created_by = current_user_id
    and ci.status = 'pending'
    and ci.expires_at > now()
  order by ci.created_at desc
  limit 1;

  if latest_pending_invite_created_at is not null
    and latest_pending_invite_created_at > now() - interval '1 minute'
  then
    raise exception 'Please wait one minute before creating a new invite code.';
  end if;

  generated_code := private.generate_connection_invite_code();

  while exists (select 1 from public.connections c where c.invite_code = generated_code)
    or exists (select 1 from public.connection_invites ci where ci.code = generated_code)
  loop
    generated_code := private.generate_connection_invite_code();
  end loop;

  insert into public.connections (
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
  returning id into target_connection_id;

  insert into public.connection_members (
    connection_id,
    user_id,
    role,
    status,
    invited_by,
    accepted_at
  )
  values (
    target_connection_id,
    current_user_id,
    'owner',
    'accepted',
    current_user_id,
    now()
  );

  return query
  insert into public.connection_invites (
    connection_id,
    code,
    created_by,
    status,
    max_uses,
    use_count,
    expires_at
  )
  values (
    target_connection_id,
    generated_code,
    current_user_id,
    'pending',
    1,
    0,
    expires_at_value
  )
  returning
    connection_invites.connection_id,
    connection_invites.code,
    connection_invites.expires_at;
end;
$$;

create or replace function public.create_connection_invite()
returns table(created_connection_id uuid, invite_code text, invite_expires_at timestamptz)
language sql
security definer
set search_path = public, private
as $$
  select * from private.create_connection_invite();
$$;

drop function if exists public.preview_connection_invite(text);
drop function if exists private.preview_connection_invite(text);

create or replace function private.preview_connection_invite(invite_code_input text)
returns table(code text, inviter_display_name text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_code text := private.normalize_connection_invite_code(invite_code_input);
  target_invite public.connection_invites%rowtype;
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
  limit 1;

  if target_invite.id is null then
    raise exception 'Invite code not found or expired.';
  end if;

  if target_invite.created_by = current_user_id then
    raise exception 'You cannot accept your own invite.';
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

create or replace function public.preview_connection_invite(invite_code_input text)
returns table(code text, inviter_display_name text, expires_at timestamptz)
language sql
security definer
set search_path = public, private
as $$
  select * from private.preview_connection_invite(invite_code_input);
$$;

drop function if exists public.accept_connection_invite(text);
drop function if exists public.join_connection_by_invite(text);
drop function if exists private.accept_connection_invite(text);

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
    and cm.connection_id = target_invite.connection_id
  limit 1;

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

grant execute on function private.create_connection_invite() to authenticated;
grant execute on function public.create_connection_invite() to authenticated;
grant execute on function private.preview_connection_invite(text) to authenticated;
grant execute on function public.preview_connection_invite(text) to authenticated;
grant execute on function private.accept_connection_invite(text) to authenticated;
grant execute on function public.accept_connection_invite(text) to authenticated;
grant execute on function public.join_connection_by_invite(text) to authenticated;
