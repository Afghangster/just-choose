create schema if not exists private;

CREATE OR REPLACE FUNCTION private.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT private.delete_user_account();
$$;

grant usage on schema private to authenticated;
grant execute on function private.delete_user_account() to authenticated;
grant execute on function public.delete_user_account() to authenticated;
