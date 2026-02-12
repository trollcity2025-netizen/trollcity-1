create table if not exists public.onesignal_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_onesignal_tokens_user_id on public.onesignal_tokens (user_id);

alter table public.onesignal_tokens enable row level security;

create policy "Users can insert their OneSignal token"
  on public.onesignal_tokens
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their OneSignal token"
  on public.onesignal_tokens
  for update
  using (auth.uid() = user_id);

create policy "Users can read their OneSignal token"
  on public.onesignal_tokens
  for select
  using (auth.uid() = user_id);
