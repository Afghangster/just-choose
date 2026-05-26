drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Assigned partners can mark their decisions answered" on public.decisions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
