drop table if exists public.decision_lock_events cascade;
drop table if exists public.decision_lock_settings cascade;
drop table if exists public.push_tokens cascade;
drop table if exists public.notification_preferences cascade;
drop table if exists public.boards cascade;

alter table public.decisions
  drop column if exists title,
  drop column if exists category,
  drop column if exists question_type,
  drop column if exists urgency,
  drop column if exists answer_style,
  drop column if exists board_id,
  drop column if exists decision_lock_eligible,
  drop column if exists decision_lock_triggered,
  drop column if exists decision_lock_started_at,
  drop column if exists decision_lock_ended_at;

alter table public.decisions
  rename column notes to note;

alter table public.decisions
  drop constraint if exists decisions_status_check,
  add constraint decisions_status_check check (status in ('pending', 'answered'));

alter table public.decision_options
  drop column if exists price,
  drop column if exists link,
  drop column if exists note;

alter table public.decision_options
  drop constraint if exists decision_options_has_content_check,
  add constraint decision_options_has_content_check check (
    nullif(trim(coalesce(title, '')), '') is not null
    or image_url is not null
  );

alter table public.decision_responses
  drop column if exists reason;

alter table public.decision_responses
  drop constraint if exists decision_responses_response_type_check,
  add constraint decision_responses_response_type_check check (
    response_type in ('selected_option', 'cant_choose')
  );

create or replace function private.mark_decision_answered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.decisions
  set
    status = 'answered',
    answered_at = new.created_at,
    updated_at = new.created_at
  where id = new.decision_id
    and status = 'pending';

  return new;
end;
$$;

grant select, insert, update, delete on
  public.profiles,
  public.couples,
  public.couple_members,
  public.decisions,
  public.decision_options,
  public.decision_responses
to authenticated;
