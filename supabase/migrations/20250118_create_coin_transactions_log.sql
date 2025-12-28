-- ENHANCE COIN TRANSACTIONS TABLE
-- Add new columns to existing coin_transactions table for comprehensive audit trail

-- Add new columns if they don't exist
alter table coin_transactions 
  add column if not exists coin_type text default 'paid',
  add column if not exists source text,
  add column if not exists platform_profit numeric default 0,
  add column if not exists liability numeric default 0,
  add column if not exists balance_after integer;

-- Add comment to clarify amount usage
comment on column coin_transactions.amount is 'Positive for credit (coins added), negative for debit (coins spent)';

-- Enhance existing indexes
create index if not exists idx_coin_transactions_type
  on coin_transactions(type);

create index if not exists idx_coin_transactions_coin_type
  on coin_transactions(coin_type);

-- Note: RLS policies already exist on coin_transactions table
-- No need to recreate. This migration only adds missing columns.

-- Add helpful comments
comment on table coin_transactions is 'Master log of all coin movements in the system';
comment on column coin_transactions.amount is 'Number of coins - positive for credits (added), negative for debits (spent)';
comment on column coin_transactions.type is 'Transaction type: purchase, gift, spin, cashout, etc';
comment on column coin_transactions.coin_type is 'paid (purchased) or free (promotional)';
comment on column coin_transactions.balance_after is 'Total coin balance (paid + free) snapshot after this transaction';
comment on column coin_transactions.metadata is 'JSON object with transaction-specific details (payment_id, package_id, etc)';
comment on column coin_transactions.platform_profit is 'Platform revenue in USD (after payment processor fees)';
comment on column coin_transactions.liability is 'Platform liability in USD (coins that could be cashed out)';

