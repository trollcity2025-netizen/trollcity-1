-- Fix user_profiles table permissions
-- This migration ensures users can save their profiles and admin can access all data



-- Grant necessary permissions to authenticated users
grant select, insert, update on table public.user_profiles to authenticated;

-- Revoke all permissions from anon (for security)
revoke all on table public.user_profiles from anon;

-- Drop existing policies to avoid conflicts
drop policy if exists "users select own profile" on public.user_profiles;
drop policy if exists "users insert own profile" on public.user_profiles;
drop policy if exists "users update own profile" on public.user_profiles;
drop policy if exists "admin select all profiles" on public.user_profiles;
drop policy if exists "admin update all profiles" on public.user_profiles;

-- Create policies for users to manage their own profiles
create policy "users select own profile"
on public.user_profiles
for select
to authenticated
using (id = auth.uid());

create policy "users insert own profile"
on public.user_profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "users update own profile"
on public.user_profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Create admin policies for trollcity2025@gmail.com
create policy "admin select all profiles"
on public.user_profiles
for select
to authenticated
using ((auth.jwt() ->> 'email') = 'trollcity2025@gmail.com');

create policy "admin update all profiles"
on public.user_profiles
for update
to authenticated
using ((auth.jwt() ->> 'email') = 'trollcity2025@gmail.com')
with check ((auth.jwt() ->> 'email') = 'trollcity2025@gmail.com');

-- Also add admin policies for other tables the admin dashboard needs
-- Streams table
alter table public.streams enable row level security;
grant select on table public.streams to authenticated;
revoke all on table public.streams from anon;

drop policy if exists "users select own streams" on public.streams;
drop policy if exists "admin select all streams" on public.streams;

create policy "users select own streams"
on public.streams
for select
to authenticated
using (broadcaster_id = auth.uid());

create policy "admin select all streams"
on public.streams
for select
to authenticated
using ((auth.jwt() ->> 'email') = 'trollcity2025@gmail.com');

-- Messages table
alter table public.messages enable row level security;
grant select on table public.messages to authenticated;
revoke all on table public.messages from anon;

drop policy if exists "users select own messages" on public.messages;
drop policy if exists "admin select all messages" on public.messages;

create policy "users select own messages"
on public.messages
for select
to authenticated
using (user_id = auth.uid());

create policy "admin select all messages"
on public.messages
for select
to authenticated
using ((auth.jwt() ->> 'email') = 'trollcity2025@gmail.com');

-- Payout requests table
alter table public.payout_requests enable row level security;
grant select, insert, update on table public.payout_requests to authenticated;
revoke all on table public.payout_requests from anon;

drop policy if exists "users select own payouts" on public.payout_requests;
drop policy if exists "users insert own payouts" on public.payout_requests;
drop policy if exists "users update own payouts" on public.payout_requests;
drop policy if exists "admin select all payouts" on public.payout_requests;
drop policy if exists "admin update all payouts" on public.payout_requests;

create policy "users select own payouts"
on public.payout_requests
for select
to authenticated
using (user_id = auth.uid());

create policy "users insert own payouts"
on public.payout_requests
for insert
to authenticated
with check (user_id = auth.uid());

create policy "users update own payouts"
on public.payout_requests
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "admin select all payouts"
on public.payout_requests
for select
to authenticated
using ((auth.jwt() ->> 'email') = 'trollcity2025@gmail.com');

create policy "admin update all payouts"
on public.payout_requests
for update
to authenticated
using ((auth.jwt() ->> 'email') = 'trollcity2025@gmail.com')
with check ((auth.jwt() ->> 'email') = 'trollcity2025@gmail.com');