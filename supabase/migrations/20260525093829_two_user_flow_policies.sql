create policy "Users can read profiles in their couples"
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
      and theirs.user_id = profiles.id
  )
);

create or replace function private.join_couple_by_invite(invite_code_input text)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_couple_id uuid;
begin
  select id
  into target_couple_id
  from public.couples
  where invite_code = upper(trim(invite_code_input));

  if target_couple_id is null then
    raise exception 'Invite code not found';
  end if;

  insert into public.couple_members (couple_id, user_id, role)
  values (target_couple_id, auth.uid(), 'member')
  on conflict (couple_id, user_id) do nothing;

  return target_couple_id;
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

grant execute on function private.join_couple_by_invite(text) to authenticated;
grant execute on function public.join_couple_by_invite(text) to authenticated;

create policy "Assigned partners can mark their decisions answered"
on public.decisions for update
to authenticated
using (
  assigned_to = (select auth.uid())
  and status = 'pending'
  and private.is_couple_member(couple_id)
)
with check (
  assigned_to = (select auth.uid())
  and status = 'answered'
  and private.is_couple_member(couple_id)
);
