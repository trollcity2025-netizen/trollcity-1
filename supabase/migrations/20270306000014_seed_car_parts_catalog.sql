INSERT INTO public.car_parts_catalog (name, part_type, description, price, image, model_url, speed_bonus, armor_bonus, weight_modifier, handling_modifier, fuel_efficiency_modifier)
VALUES
('Engine Tune', 'engine', 'Increases speed performance', 1000, NULL, NULL, 10, 0, 0, 0, 0.0),
('Armor Plating', 'armor', 'Increases durability', 1500, NULL, NULL, 0, 15, 0, 0, 0.0),
('Custom Rims', 'rims', 'Visual flair & street cred', 750, NULL, NULL, 0, 0, 0, 5, 0.0),
('Perf. Brakes', 'brakes', 'Better stopping power', 1200, NULL, NULL, 0, 0, 0, 10, 0.0),
('Suspension', 'suspension', 'Improved handling', 1100, NULL, NULL, 0, 0, 0, 12, 0.0);
