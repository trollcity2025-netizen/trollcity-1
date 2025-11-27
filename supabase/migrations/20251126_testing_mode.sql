-- Testing Mode System
-- This migration adds testing mode controls for the admin dashboard

-- App settings table to store global configuration
create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.app_settings enable row level security;

-- Only admins can read/write settings
create policy "Admins can manage app settings"
on public.app_settings
for all
using (
  exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  )
);

-- Insert initial testing mode settings
insert into public.app_settings (key, value, description)
values 
  ('testing_mode', '{"enabled": false, "signup_limit": 15, "current_signups": 0}'::jsonb, 'Testing mode configuration for controlled signups'),
  ('test_user_benefits', '{"free_coins": 5000, "bypass_family_fee": true, "bypass_admin_message_fee": true}'::jsonb, 'Benefits granted to test users during testing mode')
on conflict (key) do nothing;

-- Add is_test_user flag to user_profiles
alter table public.user_profiles
add column if not exists is_test_user boolean default false;

-- Create index for test users
create index if not exists idx_user_profiles_test_user on public.user_profiles(is_test_user) where is_test_user = true;

-- Update admin user to have username 'admin' for searchability
update public.user_profiles
set username = 'admin'
where role = 'admin' and (username is null or username != 'admin');

-- Function to check if signups are allowed
create or replace function public.can_signup()
returns boolean
language plpgsql
security definer
as $$
declare
  v_testing_mode jsonb;
  v_enabled boolean;
  v_limit int;
  v_current int;
begin
  -- Get testing mode settings
  select value into v_testing_mode
  from public.app_settings
  where key = 'testing_mode';
  
  if v_testing_mode is null then
    return true; -- No restrictions if setting doesn't exist
  end if;
  
  v_enabled := (v_testing_mode->>'enabled')::boolean;
  v_limit := (v_testing_mode->>'signup_limit')::int;
  v_current := (v_testing_mode->>'current_signups')::int;
  
  -- If testing mode is disabled, allow signups
  if not v_enabled then
    return true;
  end if;
  
  -- If testing mode is enabled, check limit
  return v_current < v_limit;
end;
$$;

-- Function to increment signup counter
create or replace function public.increment_signup_counter()
returns void
language plpgsql
security definer
as $$
declare
  v_testing_mode jsonb;
  v_current int;
begin
  -- Get current testing mode settings
  select value into v_testing_mode
  from public.app_settings
  where key = 'testing_mode';
  
  if v_testing_mode is null or not (v_testing_mode->>'enabled')::boolean then
    return; -- Don't increment if testing mode is off
  end if;
  
  v_current := (v_testing_mode->>'current_signups')::int;
  
  -- Update counter
  update public.app_settings
  set value = jsonb_set(value, '{current_signups}', to_jsonb(v_current + 1)),
      updated_at = now()
  where key = 'testing_mode';
end;
$$;

-- Function to toggle testing mode
create or replace function public.toggle_testing_mode(
  p_enabled boolean,
  p_reset_counter boolean default false
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
begin
  -- Check if user is admin
  if not exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Only admins can toggle testing mode';
  end if;
  
  -- Update testing mode
  update public.app_settings
  set value = case
    when p_reset_counter then
      jsonb_set(jsonb_set(value, '{enabled}', to_jsonb(p_enabled)), '{current_signups}', '0')
    else
      jsonb_set(value, '{enabled}', to_jsonb(p_enabled))
  end,
  updated_at = now()
  where key = 'testing_mode'
  returning value into v_result;
  
  return v_result;
end;
$$;

-- Grant execute permissions
grant execute on function public.can_signup() to anon, authenticated;
grant execute on function public.increment_signup_counter() to anon, authenticated;
grant execute on function public.toggle_testing_mode(boolean, boolean) to authenticated;
