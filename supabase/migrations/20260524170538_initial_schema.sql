create extension if not exists "pgcrypto";

create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.couple_members (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  unique (couple_id, user_id)
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  name text not null,
  category text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  assigned_to uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  category text not null,
  question_type text not null,
  urgency text not null,
  answer_style text not null,
  notes text,
  status text not null default 'pending',
  board_id uuid references public.boards(id) on delete set null,
  decision_lock_eligible boolean not null default false,
  decision_lock_triggered boolean not null default false,
  decision_lock_started_at timestamptz,
  decision_lock_ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  answered_at timestamptz,
  constraint decisions_category_check check (
    category in ('Home', 'Clothes', 'Garden', 'Food', 'Travel', 'Wedding', 'Baby', 'Gift', 'Other')
  ),
  constraint decisions_question_type_check check (
    question_type in ('pick_one', 'rank_options', 'yes_no', 'worth_the_money', 'care_or_decide')
  ),
  constraint decisions_urgency_check check (
    urgency in ('no_rush', 'today', 'in_shop', 'before_buying')
  ),
  constraint decisions_answer_style_check check (
    answer_style in (
      'just_choose',
      'be_honest',
      'think_practically',
      'help_me_feel_confident',
      'check_the_price'
    )
  ),
  constraint decisions_status_check check (status in ('pending', 'answered', 'archived'))
);

create table public.decision_options (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  label text not null,
  title text,
  image_url text,
  price numeric,
  link text,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint decision_options_sort_order_check check (sort_order >= 0 and sort_order < 6)
);

create table public.decision_responses (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  responder_id uuid not null references public.profiles(id) on delete cascade,
  selected_option_id uuid references public.decision_options(id) on delete set null,
  response_type text not null,
  reason text,
  comment text,
  created_at timestamptz not null default now(),
  constraint decision_responses_response_type_check check (
    response_type in (
      'selected_option',
      'ranked_options',
      'yes',
      'no',
      'worth_it',
      'not_worth_it',
      'i_trust_you',
      'i_dont_mind',
      'ask_me_later',
      'cant_answer_now',
      'call_me',
      'comment_only'
    )
  )
);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  nudge_enabled boolean not null default true,
  max_nudges_per_day integer not null default 5,
  quiet_hours_enabled boolean not null default true,
  quiet_hours_start text not null default '22:00',
  quiet_hours_end text not null default '08:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id),
  constraint notification_preferences_max_nudges_check check (max_nudges_per_day >= 0)
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create table public.decision_lock_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  enabled boolean not null default false,
  allowed_partner_id uuid references public.profiles(id) on delete set null,
  grace_period_minutes integer not null default 5,
  max_lock_minutes integer not null default 5,
  max_locks_per_day integer not null default 2,
  max_total_lock_minutes_per_day integer not null default 15,
  today_lock_count integer not null default 0,
  today_total_lock_minutes integer not null default 0,
  last_lock_at timestamptz,
  allow_today_urgency boolean not null default false,
  allow_in_shop_urgency boolean not null default true,
  allow_before_buying_urgency boolean not null default true,
  allow_snooze boolean not null default true,
  snooze_minutes integer not null default 10,
  allow_bypass boolean not null default true,
  bypass_requires_reason boolean not null default false,
  quiet_hours_enabled boolean not null default true,
  quiet_hours_start text not null default '22:00',
  quiet_hours_end text not null default '08:00',
  disabled_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, couple_id),
  constraint decision_lock_grace_period_check check (grace_period_minutes >= 0),
  constraint decision_lock_max_minutes_check check (max_lock_minutes between 1 and 15),
  constraint decision_lock_max_locks_check check (max_locks_per_day between 0 and 3),
  constraint decision_lock_total_minutes_check check (
    max_total_lock_minutes_per_day between 0 and 30
  ),
  constraint decision_lock_today_counts_check check (
    today_lock_count >= 0 and today_total_lock_minutes >= 0
  ),
  constraint decision_lock_snooze_minutes_check check (snooze_minutes > 0)
);

create table public.decision_lock_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  decision_id uuid references public.decisions(id) on delete set null,
  event_type text not null,
  platform text not null,
  created_at timestamptz not null default now(),
  metadata jsonb,
  constraint decision_lock_events_event_type_check check (
    event_type in (
      'permission_requested',
      'permission_granted',
      'permission_denied',
      'enabled',
      'disabled',
      'app_selection_opened',
      'lock_scheduled',
      'lock_started',
      'lock_stopped_answered',
      'lock_stopped_snoozed',
      'lock_stopped_bypassed',
      'lock_failed',
      'limit_reached',
      'quiet_hours_prevented'
    )
  )
);

create index couple_members_user_id_idx on public.couple_members(user_id);
create index boards_couple_id_idx on public.boards(couple_id);
create index decisions_couple_id_idx on public.decisions(couple_id);
create index decisions_assigned_to_status_idx on public.decisions(assigned_to, status);
create index decision_options_decision_id_idx on public.decision_options(decision_id);
create index decision_responses_decision_id_idx on public.decision_responses(decision_id);
create index notification_preferences_user_id_idx on public.notification_preferences(user_id);
create index push_tokens_user_id_idx on public.push_tokens(user_id);
create index decision_lock_settings_user_id_idx on public.decision_lock_settings(user_id);
create index decision_lock_events_user_id_idx on public.decision_lock_events(user_id);

create or replace function private.is_couple_member(target_couple_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = target_couple_id
      and cm.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_decision_in_my_couple(target_decision_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.decisions d
    where d.id = target_decision_id
      and private.is_couple_member(d.couple_id)
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
    updated_at = new.created_at,
    decision_lock_ended_at = coalesce(decision_lock_ended_at, new.created_at)
  where id = new.decision_id
    and status = 'pending';

  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger couples_set_updated_at
before update on public.couples
for each row execute function public.set_updated_at();

create trigger boards_set_updated_at
before update on public.boards
for each row execute function public.set_updated_at();

create trigger decisions_set_updated_at
before update on public.decisions
for each row execute function public.set_updated_at();

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

create trigger push_tokens_set_updated_at
before update on public.push_tokens
for each row execute function public.set_updated_at();

create trigger decision_lock_settings_set_updated_at
before update on public.decision_lock_settings
for each row execute function public.set_updated_at();

create trigger decision_responses_mark_decision_answered
after insert on public.decision_responses
for each row execute function private.mark_decision_answered();

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.boards enable row level security;
alter table public.decisions enable row level security;
alter table public.decision_options enable row level security;
alter table public.decision_responses enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_tokens enable row level security;
alter table public.decision_lock_settings enable row level security;
alter table public.decision_lock_events enable row level security;

create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) is not null and id = (select auth.uid()));

create policy "Users can create their own profile"
on public.profiles for insert
to authenticated
with check (id = (select auth.uid()));

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Users can read couples they belong to"
on public.couples for select
to authenticated
using (private.is_couple_member(id));

create policy "Users can create couples"
on public.couples for insert
to authenticated
with check (created_by = (select auth.uid()));

create policy "Users can read couple members for their couple"
on public.couple_members for select
to authenticated
using (private.is_couple_member(couple_id));

create policy "Users can join a couple as themselves"
on public.couple_members for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can leave their couple membership"
on public.couple_members for delete
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can read boards in their couple"
on public.boards for select
to authenticated
using (private.is_couple_member(couple_id));

create policy "Users can create boards in their couple"
on public.boards for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.is_couple_member(couple_id)
);

create policy "Users can update boards in their couple"
on public.boards for update
to authenticated
using (private.is_couple_member(couple_id))
with check (private.is_couple_member(couple_id));

create policy "Users can read decisions in their couple"
on public.decisions for select
to authenticated
using (private.is_couple_member(couple_id));

create policy "Users can create decisions in their couple"
on public.decisions for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.is_couple_member(couple_id)
);

create policy "Users can update pending decisions they created"
on public.decisions for update
to authenticated
using (
  created_by = (select auth.uid())
  and status = 'pending'
  and private.is_couple_member(couple_id)
)
with check (
  created_by = (select auth.uid())
  and private.is_couple_member(couple_id)
);

create policy "Users can read options for decisions in their couple"
on public.decision_options for select
to authenticated
using (private.is_decision_in_my_couple(decision_id));

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
      and private.is_couple_member(d.couple_id)
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
      and private.is_couple_member(d.couple_id)
  )
)
with check (
  exists (
    select 1
    from public.decisions d
    where d.id = decision_id
      and d.created_by = (select auth.uid())
      and d.status = 'pending'
      and private.is_couple_member(d.couple_id)
  )
);

create policy "Users can read responses for decisions in their couple"
on public.decision_responses for select
to authenticated
using (private.is_decision_in_my_couple(decision_id));

create policy "Assigned partner can create responses"
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
      and private.is_couple_member(d.couple_id)
  )
);

create policy "Users can read their own notification preferences"
on public.notification_preferences for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can create their own notification preferences"
on public.notification_preferences for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their own notification preferences"
on public.notification_preferences for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can read their own push tokens"
on public.push_tokens for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can create their own push tokens"
on public.push_tokens for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their own push tokens"
on public.push_tokens for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can delete their own push tokens"
on public.push_tokens for delete
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can read their own Decision Lock settings"
on public.decision_lock_settings for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can create their own Decision Lock settings"
on public.decision_lock_settings for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and private.is_couple_member(couple_id)
);

create policy "Users can update their own Decision Lock settings"
on public.decision_lock_settings for update
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and private.is_couple_member(couple_id)
);

create policy "Users can read their own Decision Lock events"
on public.decision_lock_events for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can create their own Decision Lock events"
on public.decision_lock_events for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and private.is_couple_member(couple_id)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'decision-images',
  'decision-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload their own decision images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'decision-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can read their own decision images"
on storage.objects for select
to authenticated
using (
  bucket_id = 'decision-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can update their own decision images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'decision-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'decision-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their own decision images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'decision-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

grant usage on schema public to authenticated;
grant usage on schema private to authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.couples,
  public.couple_members,
  public.boards,
  public.decisions,
  public.decision_options,
  public.decision_responses,
  public.notification_preferences,
  public.push_tokens,
  public.decision_lock_settings,
  public.decision_lock_events
to authenticated;

grant execute on function private.is_couple_member(uuid) to authenticated;
grant execute on function private.is_decision_in_my_couple(uuid) to authenticated;
