-- Seed coin packages with proper data
-- Delete existing packages first to avoid conflicts
DELETE FROM coin_packages WHERE name IN ('Baby Troll', 'Little Troll', 'Mischief Troll', 'Family Troll', 'Empire Troll', 'King Troll');

INSERT INTO coin_packages (name, coin_amount, price, currency, description, is_active) VALUES
('Baby Troll', 500, 6.49, 'USD', 'Perfect for getting started', true),
('Little Troll', 1100, 12.99, 'USD', 'Great value for casual users', true),
('Mischief Troll', 2500, 24.99, 'USD', 'Popular choice for active users', true),
('Family Troll', 5500, 49.99, 'USD', 'Best value for regular streamers', true),
('Empire Troll', 12000, 99.99, 'USD', 'For the ultimate Troll City experience', true),
('King Troll', 25000, 199.99, 'USD', 'The ultimate package for power users', true);