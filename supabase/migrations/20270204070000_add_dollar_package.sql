
-- Add $1 coin package (1000 coins)
-- We use ON CONFLICT to avoid errors if run multiple times
-- Assuming id is text based on usage in codebase (pkg-500, etc)

INSERT INTO public.coin_packages (id, name, coins, price, label, description, is_active, currency)
VALUES 
  ('pkg-1000-promo', 'Promo Pack', 1000, 1.00, '1,000 Coins', 'Limited time offer!', true, 'USD')
ON CONFLICT (id) DO UPDATE
SET 
  coins = EXCLUDED.coins,
  price = EXCLUDED.price,
  label = EXCLUDED.label,
  is_active = EXCLUDED.is_active;

-- Also ensure other packages exist just in case (syncing with frontend)
INSERT INTO public.coin_packages (id, name, coins, price, label, description, is_active, currency)
VALUES 
  ('pkg-500', 'Starter Pack', 500, 4.99, '500 Coins', 'Get started', true, 'USD'),
  ('pkg-1000', 'Basic Pack', 1000, 9.99, '1,000 Coins', 'Standard pack', true, 'USD'),
  ('pkg-2500', 'Value Pack', 2500, 19.99, '2,500 Coins', 'Best value', true, 'USD'),
  ('pkg-5000', 'Pro Pack', 5000, 36.99, '5,000 Coins', 'For pros', true, 'USD'),
  ('pkg-10000', 'Elite Pack', 10000, 69.99, '10,000 Coins', 'Elite status', true, 'USD')
ON CONFLICT (id) DO NOTHING;
