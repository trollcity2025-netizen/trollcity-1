-- 1) Connected Shopify stores
create table if not exists public.shopify_stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  shop_domain text not null unique,
  access_token text not null,
  scopes text,
  currency text default 'USD',
  platform_cut_percent numeric(5,2) not null default 12.50,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shopify_stores enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'shopify_stores'
      and policyname = 'shopify_stores_owner_select'
  ) then
    create policy "shopify_stores_owner_select"
      on public.shopify_stores
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'shopify_stores'
      and policyname = 'shopify_stores_owner_update'
  ) then
    create policy "shopify_stores_owner_update"
      on public.shopify_stores
      for update
      using (auth.uid() = user_id);
  end if;
end $$;

-- 2) Order log from Shopify webhooks
create table if not exists public.shopify_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.shopify_stores(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  shop_domain text not null,
  shopify_order_id text not null,
  shopify_order_number text,
  total_gross numeric(12,2) not null,
  currency text not null default 'USD',
  platform_cut_percent numeric(5,2) not null,
  platform_cut_amount numeric(12,2) not null,
  creator_earnings numeric(12,2) not null,
  raw_payload jsonb,
  status text not null default 'paid', -- paid / refunded / partially_refunded
  created_at timestamptz not null default now()
);

create index if not exists idx_shopify_orders_store
  on public.shopify_orders(store_id);

create index if not exists idx_shopify_orders_user
  on public.shopify_orders(user_id);

alter table public.shopify_orders enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='shopify_orders'
      and policyname='shopify_orders_owner_select'
  ) then
    create policy "shopify_orders_owner_select"
      on public.shopify_orders
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

-- 3) Optional: earnings aggregation view
create or replace view public.shopify_earnings_summary as
select
  s.user_id,
  s.id as store_id,
  s.shop_domain,
  coalesce(sum(o.total_gross), 0) as total_gross,
  coalesce(sum(o.platform_cut_amount), 0) as total_platform_cut,
  coalesce(sum(o.creator_earnings), 0) as total_creator_earnings
from public.shopify_stores s
left join public.shopify_orders o
  on o.store_id = s.id
group by s.user_id, s.id, s.shop_domain;