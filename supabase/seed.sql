do $$
declare
  seed_alice_id uuid := '00000000-0000-4000-8000-000000000001';
  seed_bob_id uuid := '00000000-0000-4000-8000-000000000002';
  seed_connection_id uuid := '00000000-0000-4000-8000-000000000010';
  seed_decision_id uuid := '00000000-0000-4000-8000-000000000030';
  seed_option_a_id uuid := '00000000-0000-4000-8000-000000000031';
  seed_option_b_id uuid := '00000000-0000-4000-8000-000000000032';
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values
    (
      '00000000-0000-0000-0000-000000000000',
      seed_alice_id,
      'authenticated',
      'authenticated',
      'alice@justchoose.test',
      crypt('mielad', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Alice"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      seed_bob_id,
      'authenticated',
      'authenticated',
      'bob@justchoose.test',
      crypt('mielad', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Bob"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
  on conflict (id) do update
  set
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = excluded.email_confirmed_at,
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values
    (
      seed_alice_id,
      seed_alice_id,
      seed_alice_id,
      jsonb_build_object('sub', seed_alice_id::text, 'email', 'alice@justchoose.test'),
      'email',
      now(),
      now(),
      now()
    ),
    (
      seed_bob_id,
      seed_bob_id,
      seed_bob_id,
      jsonb_build_object('sub', seed_bob_id::text, 'email', 'bob@justchoose.test'),
      'email',
      now(),
      now(),
      now()
    )
  on conflict (provider_id, provider) do update
  set
    identity_data = excluded.identity_data,
    last_sign_in_at = excluded.last_sign_in_at,
    updated_at = now();

  insert into public.profiles (id, display_name, age, gender, avatar_url)
  values
    (seed_alice_id, 'Alice', 31, 'woman', null),
    (seed_bob_id, 'Bob', 32, 'man', null)
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    age = excluded.age,
    gender = excluded.gender,
    avatar_url = excluded.avatar_url,
    updated_at = now();

  insert into public.connections (
    id,
    invite_code,
    created_by,
    billing_owner_user_id,
    subscription_status,
    plan
  )
  values (
    seed_connection_id,
    'TESTDUO',
    seed_alice_id,
    seed_alice_id,
    'active',
    'connection'
  )
  on conflict (id) do update
  set
    invite_code = excluded.invite_code,
    created_by = excluded.created_by,
    billing_owner_user_id = excluded.billing_owner_user_id,
    subscription_status = excluded.subscription_status,
    plan = excluded.plan,
    updated_at = now();

  insert into public.connection_members (
    id,
    connection_id,
    user_id,
    role,
    status,
    invited_by,
    accepted_at
  )
  values
    ('00000000-0000-4000-8000-000000000011', seed_connection_id, seed_alice_id, 'owner', 'accepted', seed_alice_id, now()),
    ('00000000-0000-4000-8000-000000000012', seed_connection_id, seed_bob_id, 'member', 'accepted', seed_alice_id, now())
  on conflict (connection_id, user_id) do update
  set
    role = excluded.role,
    status = excluded.status,
    invited_by = excluded.invited_by,
    accepted_at = excluded.accepted_at;

  insert into public.connection_invites (
    id,
    connection_id,
    code,
    created_by,
    accepted_by,
    status,
    max_uses,
    use_count,
    expires_at,
    accepted_at
  )
  values (
    '00000000-0000-4000-8000-000000000013',
    seed_connection_id,
    'TESTDUO',
    seed_alice_id,
    seed_bob_id,
    'accepted',
    1,
    1,
    now() + interval '1 hour',
    now()
  )
  on conflict (id) do update
  set
    code = excluded.code,
    accepted_by = excluded.accepted_by,
    status = excluded.status,
    use_count = excluded.use_count,
    accepted_at = excluded.accepted_at;

  insert into public.decisions (
    id,
    connection_id,
    created_by,
    assigned_to,
    note,
    status
  )
  values (
    seed_decision_id,
    seed_connection_id,
    seed_alice_id,
    seed_bob_id,
    'Which sofa should we pick?',
    'pending'
  )
  on conflict (id) do update
  set
    note = excluded.note,
    status = excluded.status,
    updated_at = now();

  insert into public.decision_options (
    id,
    decision_id,
    label,
    title,
    image_url,
    sort_order
  )
  values
    (seed_option_a_id, seed_decision_id, 'A', 'Green sofa', null, 0),
    (seed_option_b_id, seed_decision_id, 'B', 'Blue sofa', null, 1)
  on conflict (id) do update
  set
    title = excluded.title,
    image_url = excluded.image_url,
    sort_order = excluded.sort_order;
end $$;
