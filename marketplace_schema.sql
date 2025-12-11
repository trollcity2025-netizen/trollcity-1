-- Troll City Marketplace Schema
-- Run this in your Supabase SQL editor

-- 1. Marketplace Items Table
create table marketplace_items (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references profiles(id),
  title text not null,
  description text,
  price_coins bigint not null,
  stock int,
  thumbnail_url text,
  type text check (type in ('digital', 'physical', 'effect', 'badge', 'ticket')),
  status text default 'active' check (status in ('active','sold_out','removed')),
  created_at timestamptz default now()
);

-- 2. Marketplace Purchases Table
create table marketplace_purchases (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references profiles(id),
  seller_id uuid references profiles(id),
  item_id uuid references marketplace_items(id),
  price_paid bigint not null,
  platform_fee bigint not null,
  seller_earnings bigint not null,
  created_at timestamptz default now()
);

-- 3. User Inventory Table
create table user_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  item_id uuid references marketplace_items(id),
  acquired_at timestamptz default now()
);

-- 4. User Active Items Table (for digital item activation)
create table user_active_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  item_id uuid references marketplace_items(id),
  item_type text not null,
  activated_at timestamptz default now(),
  unique(user_id, item_id)
);