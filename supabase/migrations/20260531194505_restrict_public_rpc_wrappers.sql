create or replace function public.create_connection_invite()
returns table(created_connection_id uuid, invite_code text, invite_expires_at timestamptz)
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

create or replace function public.pending_connection_requests()
returns table(connection_id uuid, requester_id uuid, requester_display_name text, requested_at timestamptz)
language sql
security invoker
set search_path = public, private
as $$
  select * from private.pending_connection_requests();
$$;

create or replace function public.approve_connection_request(requester_user_id uuid)
returns uuid
language sql
security invoker
set search_path = public, private
as $$
  select private.approve_connection_request(requester_user_id);
$$;

create or replace function public.reject_connection_request(requester_user_id uuid)
returns uuid
language sql
security invoker
set search_path = public, private
as $$
  select private.reject_connection_request(requester_user_id);
$$;

revoke execute on function public.create_connection_invite() from anon, public;
revoke execute on function public.preview_connection_invite(text) from anon, public;
revoke execute on function public.accept_connection_invite(text) from anon, public;
revoke execute on function public.join_connection_by_invite(text) from anon, public;
revoke execute on function public.pending_connection_requests() from anon, public;
revoke execute on function public.approve_connection_request(uuid) from anon, public;
revoke execute on function public.reject_connection_request(uuid) from anon, public;

grant execute on function public.create_connection_invite() to authenticated;
grant execute on function public.preview_connection_invite(text) to authenticated;
grant execute on function public.accept_connection_invite(text) to authenticated;
grant execute on function public.join_connection_by_invite(text) to authenticated;
grant execute on function public.pending_connection_requests() to authenticated;
grant execute on function public.approve_connection_request(uuid) to authenticated;
grant execute on function public.reject_connection_request(uuid) to authenticated;
