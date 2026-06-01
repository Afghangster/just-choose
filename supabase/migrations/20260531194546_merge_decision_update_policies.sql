drop policy if exists "Users can update pending decisions they created" on public.decisions;
drop policy if exists "Assigned connections can mark their decisions answered" on public.decisions;

create policy "Connection members can update relevant decisions"
on public.decisions for update
to authenticated
using (
  (
    created_by = (select auth.uid())
    and status = 'pending'
    and private.is_connection_member(connection_id)
  )
  or (
    assigned_to = (select auth.uid())
    and status = 'pending'
    and private.is_connection_member(connection_id)
  )
)
with check (
  (
    created_by = (select auth.uid())
    and private.is_connection_member(connection_id)
  )
  or (
    assigned_to = (select auth.uid())
    and status = 'answered'
    and private.is_connection_member(connection_id)
  )
);
