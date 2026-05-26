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

  select cm.connection_id
  into target_connection_id
  from public.connection_members cm
  where cm.user_id = current_user_id
    and cm.status = 'accepted'
  order by cm.joined_at desc
  limit 1;

  if target_connection_id is not null and exists (
    select 1
    from public.connection_members cm
    where cm.connection_id = target_connection_id
      and cm.user_id <> current_user_id
      and cm.status = 'accepted'
  ) then
    raise exception 'You already have an accepted connection.';
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

  if target_connection_id is null then
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
    )
    on conflict (connection_id, user_id) do update
    set
      role = 'owner',
      status = 'accepted',
      invited_by = excluded.invited_by,
      accepted_at = now();
  else
    update public.connection_invites ci
    set
      status = 'revoked',
      revoked_at = now()
    where ci.connection_id = target_connection_id
      and ci.created_by = current_user_id
      and ci.status = 'pending';

    update public.connections c
    set invite_code = generated_code
    where c.id = target_connection_id;
  end if;

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

grant execute on function private.create_connection_invite() to authenticated;
grant execute on function public.create_connection_invite() to authenticated;
