-- Insert default coin packages
INSERT INTO coin_packages (name, coin_amount, price, currency, description, is_active) VALUES
('Baby Troll', 500, 6.49, 'USD', 'Perfect for beginners!', true),
('Little Troller', 1440, 12.99, 'USD', 'Great value pack!', true),
('Mischief Pack', 3280, 19.99, 'USD', 'Popular choice!', true),
('Troll Family Pack', 7700, 49.99, 'USD', 'Share the fun!', true),
('Troll Empire Pack', 25400, 139.99, 'USD', 'Rule the city!', true),
('Mega Troll King Pack', 51800, 279.99, 'USD', 'Ultimate power!', true);

-- Insert default wheel slices
INSERT INTO wheel_slices (name, type, value, probability, color, is_active) VALUES
('100 Coins', 'coins', 100, 0.35, '#22c55e', true),
('1,000 Coins', 'coins', 1000, 0.25, '#16a34a', true),
('10,000 Coins', 'coins', 10000, 0.15, '#15803d', true),
('1,000,000 Coins', 'coins', 1000000, 0.01, '#ffd700', true),
('Bankrupt', 'bankrupt', 50, 0.10, '#ef4444', true),
('No Kick Day', 'perk', 0, 0.07, '#3b82f6', true),
('No Ban Day', 'perk', 0, 0.07, '#6366f1', true);

-- Insert default insurance packages
INSERT INTO insurance_packages (name, level, cost, duration_days, benefits, is_active) VALUES
('Basic Insurance', 'basic', 500, 7, '{"Reduces kick penalties by 50%", "1 free unban"}', true),
('Premium Insurance', 'premium', 2000, 30, '{"Reduces kick penalties by 75%", "Reduces ban penalties by 50%", "3 free unbans", "Priority support"}', true);

-- Insert default cashout tiers
INSERT INTO cashout_tiers (coin_amount, cash_amount, currency, processing_fee_percentage, is_active) VALUES
(2100, 21.00, 'USD', 5.0, true),
(4900, 49.00, 'USD', 5.0, true),
(9000, 90.00, 'USD', 4.0, true),
(15500, 155.00, 'USD', 3.5, true);

-- Create admin user (you'll need to create the auth user first, then run this)
-- This is a placeholder - you'll need to manually create the admin user in Supabase auth first
-- INSERT INTO user_profiles (id, username, avatar_url, bio, role, tier, paid_coin_balance, free_coin_balance, total_earned_coins, total_spent_coins) VALUES
-- ('admin-user-id-from-auth', 'Admin', 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', 'The supreme ruler of Troll City!', 'admin', 'Platinum', 100000, 50000, 150000, 0);