drop function if exists public.join_couple_by_invite(text);
drop function if exists public.accept_pairing_invite(text);
drop function if exists public.preview_pairing_invite(text);
drop function if exists public.create_pairing_invite();
drop function if exists private.join_couple_by_invite(text);
drop function if exists private.accept_pairing_invite(text);
drop function if exists private.preview_pairing_invite(text);
drop function if exists private.create_pairing_invite();
drop function if exists private.generate_pairing_invite_code();
drop function if exists private.normalize_pairing_invite_code(text);

alter table if exists public.pairing_invites rename to connection_invites;
alter table if exists public.couple_members rename to connection_members;
alter table if exists public.couples rename to connections;

alter table if exists public.boards rename column couple_id to connection_id;
alter table if exists public.connection_members rename column couple_id to connection_id;
alter table if exists public.connection_invites rename column couple_id to connection_id;
alter table if exists public.decisions rename column couple_id to connection_id;
alter table if exists public.decision_lock_settings rename column couple_id to connection_id;
alter table if exists public.decision_lock_events rename column couple_id to connection_id;

alter index if exists couple_members_user_id_idx rename to connection_members_user_id_idx;
alter index if exists couple_members_one_accepted_couple_per_user_idx rename to connection_members_one_accepted_connection_per_user_idx;
alter index if exists pairing_invites_couple_id_idx rename to connection_invites_connection_id_idx;
alter index if exists pairing_invites_code_pending_idx rename to connection_invites_code_pending_idx;
alter index if exists pairing_invites_one_pending_per_creator_idx rename to connection_invites_one_pending_per_creator_idx;
alter index if exists decisions_couple_id_idx rename to decisions_connection_id_idx;
alter index if exists boards_couple_id_idx rename to boards_connection_id_idx;

alter table if exists public.connections rename constraint couples_subscription_status_check to connections_subscription_status_check;
alter table if exists public.connection_members rename constraint couple_members_status_check to connection_members_status_check;
alter table if exists public.connection_invites rename constraint pairing_invites_status_check to connection_invites_status_check;
alter table if exists public.connection_invites rename constraint pairing_invites_max_uses_check to connection_invites_max_uses_check;
alter table if exists public.connection_invites rename constraint pairing_invites_use_count_check to connection_invites_use_count_check;

drop trigger if exists pairing_invites_set_updated_at on public.connection_invites;
drop trigger if exists connection_invites_set_updated_at on public.connection_invites;
create trigger connection_invites_set_updated_at
before update on public.connection_invites
for each row execute function public.set_updated_at();

drop policy if exists "Users can read couples they belong to" on public.connections;
drop policy if exists "Users can create couples" on public.connections;
drop policy if exists "Couple creators can add their accepted owner membership" on public.connection_members;
drop policy if exists "Users can join a couple as themselves" on public.connection_members;
drop policy if exists "Users can read couple members for their couple" on public.connection_members;
drop policy if exists "Users can leave their couple membership" on public.connection_members;
drop policy if exists "Users can read decisions in their couple" on public.decisions;
drop policy if exists "Users can create decisions in their couple" on public.decisions;
drop policy if exists "Users can update pending decisions they created" on public.decisions;
drop policy if exists "Assigned partners can mark their decisions answered" on public.decisions;
drop policy if exists "Users can read options for decisions in their couple" on public.decision_options;
drop policy if exists "Creators can create options for their pending decisions" on public.decision_options;
drop policy if exists "Creators can update options for their pending decisions" on public.decision_options;
drop policy if exists "Users can read responses for decisions in their couple" on public.decision_responses;
drop policy if exists "Assigned partner can create responses" on public.decision_responses;
drop policy if exists "Members can read pairing invites in their couple" on public.connection_invites;
drop policy if exists "Members can create pairing invites for their couple" on public.connection_invites;
drop policy if exists "Invite creators can revoke pending pairing invites" on public.connection_invites;
drop policy if exists "Users can read profiles in their couples" on public.profiles;
drop policy if exists "Users can read profiles in accepted couples" on public.profiles;
drop policy if exists "Users can read own and partner push tokens" on public.push_tokens;
drop policy if exists "Users can read their own push tokens" on public.push_tokens;

drop function if exists private.is_decision_in_my_couple(uuid);
drop function if exists private.is_couple_member(uuid);

create or replace function private.is_connection_member(target_connection_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.connection_members cm
    where cm.connection_id = target_connection_id
      and cm.user_id = (select auth.uid())
      and cm.status = 'accepted'
  );
$$;

create or replace function private.is_decision_in_my_connection(target_decision_id uuid)
returns boolean
language sql
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.decisions d
    where d.id = target_decision_id
      and private.is_connection_member(d.connection_id)
  );
$$;

create policy "Users can read connections they belong to"
on public.connections for select
to authenticated
using (private.is_connection_member(id));

create policy "Users can create connections"
on public.connections for insert
to authenticated
with check (created_by = (select auth.uid()));

create policy "Connection creators can add their accepted owner membership"
on public.connection_members for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'accepted'
  and exists (
    select 1
    from public.connections c
    where c.id = connection_id
      and c.created_by = (select auth.uid())
  )
);

create policy "Users can read connection members for their connection"
on public.connection_members for select
to authenticated
using (private.is_connection_member(connection_id));

create policy "Users can leave their connection membership"
on public.connection_members for delete
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can read decisions in their connection"
on public.decisions for select
to authenticated
using (private.is_connection_member(connection_id));

create policy "Users can create decisions in their connection"
on public.decisions for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.is_connection_member(connection_id)
);

create policy "Users can update pending decisions they created"
on public.decisions for update
to authenticated
using (
  created_by = (select auth.uid())
  and status = 'pending'
  and private.is_connection_member(connection_id)
)
with check (
  created_by = (select auth.uid())
  and private.is_connection_member(connection_id)
);

create policy "Assigned connections can mark their decisions answered"
on public.decisions for update
to authenticated
using (
  assigned_to = (select auth.uid())
  and status = 'pending'
  and private.is_connection_member(connection_id)
)
with check (
  assigned_to = (select auth.uid())
  and status = 'answered'
  and private.is_connection_member(connection_id)
);

create policy "Users can read options for decisions in their connection"
on public.decision_options for select
to authenticated
using (private.is_decision_in_my_connection(decision_id));

create policy "Creators can create options for their pending decisions"
on public.decision_options for insert
to authenticated
with check (
  exists (
    select 1
    from public.decisions d
    where d.id = decision_id
      and d.created_by = (select auth.uid())
      and d.status = 'pending'
      and private.is_connection_member(d.connection_id)
  )
);

create policy "Creators can update options for their pending decisions"
on public.decision_options for update
to authenticated
using (
  exists (
    select 1
    from public.decisions d
    where d.id = decision_id
      and d.created_by = (select auth.uid())
      and d.status = 'pending'
      and private.is_connection_member(d.connection_id)
  )
)
with check (
  exists (
    select 1
    from public.decisions d
    where d.id = decision_id
      and d.created_by = (select auth.uid())
      and d.status = 'pending'
      and private.is_connection_member(d.connection_id)
  )
);

create policy "Users can read responses for decisions in their connection"
on public.decision_responses for select
to authenticated
using (private.is_decision_in_my_connection(decision_id));

create policy "Assigned connection can create responses"
on public.decision_responses for insert
to authenticated
with check (
  responder_id = (select auth.uid())
  and exists (
    select 1
    from public.decisions d
    where d.id = decision_id
      and d.assigned_to = (select auth.uid())
      and d.status = 'pending'
      and private.is_connection_member(d.connection_id)
  )
);

create policy "Users can read profiles in accepted connections"
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.connection_members mine
    join public.connection_members theirs
      on theirs.connection_id = mine.connection_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'accepted'
      and theirs.status = 'accepted'
      and theirs.user_id = profiles.id
  )
);

create policy "Users can read own and connection push tokens"
on public.push_tokens for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.connection_members mine
    join public.connection_members theirs
      on theirs.connection_id = mine.connection_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'accepted'
      and theirs.status = 'accepted'
      and theirs.user_id = push_tokens.user_id
  )
);

create policy "Members can read connection invites"
on public.connection_invites for select
to authenticated
using (private.is_connection_member(connection_id));

create policy "Members can create connection invites"
on public.connection_invites for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and status = 'pending'
  and private.is_connection_member(connection_id)
);

create policy "Invite creators can revoke pending connection invites"
on public.connection_invites for update
to authenticated
using (
  created_by = (select auth.uid())
  and status = 'pending'
  and private.is_connection_member(connection_id)
)
with check (
  created_by = (select auth.uid())
  and status in ('pending', 'revoked')
  and private.is_connection_member(connection_id)
);

create or replace function private.normalize_connection_invite_code(invite_code_input text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select regexp_replace(upper(coalesce(invite_code_input, '')), '[^A-Z0-9]', '', 'g');
$$;

create or replace function private.generate_connection_invite_code()
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

create or replace function private.create_connection_invite()
returns table(connection_id uuid, code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  target_connection_id uuid;
  generated_code text;
  invite_expires_at timestamptz := now() + interval '1 hour';
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
    invite_expires_at
  )
  returning connection_invites.connection_id, connection_invites.code, connection_invites.expires_at;
end;
$$;

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
  existing_connection_id uuid;
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

  select cm.connection_id
  into existing_connection_id
  from public.connection_members cm
  where cm.user_id = current_user_id
    and cm.status = 'accepted'
  limit 1;

  if existing_connection_id is not null and existing_connection_id <> target_invite.connection_id then
    raise exception 'You already have an accepted connection.';
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
  existing_connection_id uuid;
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

  select cm.connection_id
  into existing_connection_id
  from public.connection_members cm
  where cm.user_id = current_user_id
    and cm.status = 'accepted'
  limit 1;

  if existing_connection_id is not null and existing_connection_id <> target_invite.connection_id then
    raise exception 'You already have an accepted connection.';
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
    'accepted',
    target_invite.created_by,
    now()
  )
  on conflict (connection_id, user_id) do update
  set
    status = 'accepted',
    role = excluded.role,
    invited_by = excluded.invited_by,
    accepted_at = now();

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

create or replace function private.join_connection_by_invite(invite_code_input text)
returns uuid
language sql
security definer
set search_path = public, private
as $$
  select private.accept_connection_invite(invite_code_input);
$$;

create or replace function public.create_connection_invite()
returns table(connection_id uuid, code text, expires_at timestamptz)
language sql
security invoker
set search_path = public, private
as $$
  select * from private.create_connection_invite();
$$;

create or replace function public.preview_connection_invite(invite_code_input text)
returns table(code text, inviter_display_name text, expires_at timestamptz)
language sql
security invoker
set search_path = public, private
as $$
  select * from private.preview_connection_invite(invite_code_input);
$$;

create or replace function public.accept_connection_invite(invite_code_input text)
returns uuid
language sql
security invoker
set search_path = public, private
as $$
  select private.accept_connection_invite(invite_code_input);
$$;

create or replace function public.join_connection_by_invite(invite_code_input text)
returns uuid
language sql
security invoker
set search_path = public, private
as $$
  select private.accept_connection_invite(invite_code_input);
$$;

grant select, insert, update on public.connection_invites to authenticated;
grant select, insert, update on public.connections to authenticated;
grant select, insert, update, delete on public.connection_members to authenticated;
grant execute on function private.is_connection_member(uuid) to authenticated;
grant execute on function private.is_decision_in_my_connection(uuid) to authenticated;
grant execute on function private.normalize_connection_invite_code(text) to authenticated;
grant execute on function private.generate_connection_invite_code() to authenticated;
grant execute on function private.create_connection_invite() to authenticated;
grant execute on function private.preview_connection_invite(text) to authenticated;
grant execute on function private.accept_connection_invite(text) to authenticated;
grant execute on function private.join_connection_by_invite(text) to authenticated;
grant execute on function public.create_connection_invite() to authenticated;
grant execute on function public.preview_connection_invite(text) to authenticated;
grant execute on function public.accept_connection_invite(text) to authenticated;
grant execute on function public.join_connection_by_invite(text) to authenticated;
