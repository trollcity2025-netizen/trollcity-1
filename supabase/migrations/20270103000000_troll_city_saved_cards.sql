-- Troll City Saved Cards Table
-- Clean schema for storing Square card-on-file data

create table if not exists public.saved_cards (
  id uuid primary key default gen_random_uuid(),

  -- User relationship
  user_id uuid not null references public.user_profiles(id) on delete cascade,

  -- Square integration (required for charging)
  square_customer_id text not null,  -- Square customer ID
  square_card_id text not null,      -- Square card-on-file ID (starts with 'ccof:')

  -- Card metadata (for display/UI)
  brand text not null,               -- 'Visa', 'Mastercard', 'American Express', etc.
  last_4 text not null,              -- Last 4 digits for display
  exp_month integer not null,        -- Expiration month (1-12)
  exp_year integer not null,         -- Expiration year (4 digits)

  -- Status and preferences
  status text not null default 'active',  -- 'active', 'expired', 'disabled'
  is_default boolean not null default false,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_saved_cards_user_id on public.saved_cards(user_id);
create index if not exists idx_saved_cards_square_customer on public.saved_cards(square_customer_id);
create index if not exists idx_saved_cards_square_card on public.saved_cards(square_card_id);
create index if not exists idx_saved_cards_default on public.saved_cards(user_id, is_default) where is_default = true;

-- Enable RLS (Row Level Security)
alter table public.saved_cards enable row level security;

-- RLS Policies
create policy "Users can view their own saved cards"
on public.saved_cards for select
using (auth.uid() = user_id);

create policy "Users can insert their own saved cards"
on public.saved_cards for insert
with check (auth.uid() = user_id);

create policy "Users can update their own saved cards"
on public.saved_cards for update
using (auth.uid() = user_id);

create policy "Users can delete their own saved cards"
on public.saved_cards for delete
using (auth.uid() = user_id);

-- Updated_at trigger
create or replace function update_saved_cards_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger saved_cards_updated_at
  before update on public.saved_cards
  for each row execute function update_saved_cards_updated_at();