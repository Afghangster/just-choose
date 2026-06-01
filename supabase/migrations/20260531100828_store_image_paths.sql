alter table public.profiles
  add column if not exists avatar_path text;

alter table public.connection_aliases
  add column if not exists avatar_path text;

alter table public.decision_options
  add column if not exists image_path text;
