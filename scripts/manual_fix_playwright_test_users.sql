-- Manual test-environment repair script
-- Run this in Supabase SQL Editor as a privileged user (postgres/service role context).
-- It recreates/fixes the Playwright test users and their role/profile/tax state.

begin;

create extension if not exists pgcrypto;

create temporary table if not exists _tc_test_users (
  email text primary key,
  username text not null,
  role text not null,
  is_admin boolean not null,
  is_troll_officer boolean not null,
  is_lead_officer boolean not null,
  is_officer_active boolean not null,
  password text not null
) on commit drop;

truncate _tc_test_users;

insert into _tc_test_users (email, username, role, is_admin, is_troll_officer, is_lead_officer, is_officer_active, password)
values
  ('admin@test.com',       'admin_test_profile',       'admin',              true,  false, false, false, 'Test123!@#'),
  ('secretary@test.com',   'secretary_test_profile',   'secretary',          false, false, false, false, 'Test123!@#'),
  ('lead.troll@test.com',  'lead_troll_test_profile',  'lead_troll_officer', false, true,  true,  true,  'Test123!@#'),
  ('officer@test.com',     'officer_test_profile',     'troll_officer',      false, true,  false, true,  'Test123!@#'),
  ('user@test.com',        'user_test_profile',        'user',               false, false, false, false, 'Test123!@#'),
  ('member@test.com',      'member_test_1',            'user',               false, false, false, false, 'Test123!@#'),
  ('broadcaster@test.com', 'broadcaster_test_1',       'user',               false, false, false, false, 'Test123!@#');

do $$
declare
  r record;
  v_uid uuid;
  v_role_id uuid;
begin
  for r in select * from _tc_test_users loop
    select id into v_uid
    from auth.users
    where lower(email) = lower(r.email)
    limit 1;

    if v_uid is null then
      insert into auth.users (
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
      )
      values (
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        lower(r.email),
        crypt(r.password, gen_salt('bf')),
        now(),
        jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
        jsonb_build_object('username', r.username),
        now(),
        now()
      )
      returning id into v_uid;
    else
      update auth.users
      set encrypted_password = crypt(r.password, gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('username', r.username),
          updated_at = now()
      where id = v_uid;
    end if;

    insert into public.user_profiles (id, email, username, role)
    values (v_uid, lower(r.email), r.username, r.role)
    on conflict (id) do update
      set email = excluded.email,
          username = excluded.username,
          role = excluded.role;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'full_name') then
      execute 'update public.user_profiles set full_name = $1 where id = $2'
      using initcap(split_part(r.username, '_', 1)) || ' Test User', v_uid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'gender') then
      execute 'update public.user_profiles set gender = $1 where id = $2' using 'male', v_uid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'troll_role') then
      execute 'update public.user_profiles set troll_role = $1 where id = $2' using r.role, v_uid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'is_admin') then
      execute 'update public.user_profiles set is_admin = $1 where id = $2' using r.is_admin, v_uid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'is_troll_officer') then
      execute 'update public.user_profiles set is_troll_officer = $1 where id = $2' using r.is_troll_officer, v_uid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'is_lead_officer') then
      execute 'update public.user_profiles set is_lead_officer = $1 where id = $2' using r.is_lead_officer, v_uid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'is_officer_active') then
      execute 'update public.user_profiles set is_officer_active = $1 where id = $2' using r.is_officer_active, v_uid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'terms_accepted') then
      execute 'update public.user_profiles set terms_accepted = true where id = $1' using v_uid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'court_recording_consent') then
      execute 'update public.user_profiles set court_recording_consent = true where id = $1' using v_uid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'court_recording_consent_at') then
      execute 'update public.user_profiles set court_recording_consent_at = now() where id = $1' using v_uid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'troll_coins') then
      execute 'update public.user_profiles set troll_coins = greatest(coalesce(troll_coins, 0), 10000) where id = $1' using v_uid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'total_earned_coins') then
      execute 'update public.user_profiles set total_earned_coins = greatest(coalesce(total_earned_coins, 0), 10000) where id = $1' using v_uid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'total_spent_coins') then
      execute 'update public.user_profiles set total_spent_coins = coalesce(total_spent_coins, 0) where id = $1' using v_uid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'is_test_user') then
      execute 'update public.user_profiles set is_test_user = true where id = $1' using v_uid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'updated_at') then
      execute 'update public.user_profiles set updated_at = now() where id = $1' using v_uid;
    end if;

    insert into public.user_tax_info (user_id, legal_full_name, w9_status, tax_classification)
    values (v_uid, initcap(split_part(r.username, '_', 1)) || ' Test User', 'approved', 'individual')
    on conflict (user_id) do update
      set legal_full_name = excluded.legal_full_name,
          w9_status = excluded.w9_status,
          tax_classification = excluded.tax_classification;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_tax_info' and column_name = 'full_name') then
      execute 'update public.user_tax_info set full_name = $1 where user_id = $2'
      using initcap(split_part(r.username, '_', 1)) || ' Test User', v_uid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_tax_info' and column_name = 'tax_verification_status') then
      execute 'update public.user_tax_info set tax_verification_status = ''approved'' where user_id = $1' using v_uid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_tax_info' and column_name = 'status') then
      execute 'update public.user_tax_info set status = ''approved'' where user_id = $1' using v_uid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_tax_info' and column_name = 'submitted_at') then
      execute 'update public.user_tax_info set submitted_at = coalesce(submitted_at, now()) where user_id = $1' using v_uid;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_tax_info' and column_name = 'updated_at') then
      execute 'update public.user_tax_info set updated_at = now() where user_id = $1' using v_uid;
    end if;

    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'system_roles')
       and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_role_grants') then
      select id into v_role_id from public.system_roles where name = r.role limit 1;
      if v_role_id is not null then
        insert into public.user_role_grants (user_id, role_id, granted_by, granted_at)
        values (v_uid, v_role_id, v_uid, now())
        on conflict do nothing;
      end if;
    end if;
  end loop;
end $$;

-- Useful verification output
select
  u.email,
  p.username,
  p.role,
  p.is_admin,
  p.is_troll_officer,
  p.is_lead_officer,
  p.is_officer_active,
  p.terms_accepted,
  p.court_recording_consent
from public.user_profiles p
join auth.users u on u.id = p.id
where lower(u.email) in (
  'admin@test.com',
  'secretary@test.com',
  'lead.troll@test.com',
  'officer@test.com',
  'user@test.com',
  'member@test.com',
  'broadcaster@test.com'
)
order by u.email;

commit;
