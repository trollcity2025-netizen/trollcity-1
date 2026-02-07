-- 3. Seed Vehicles (Updated with Correct Image for Eclipse Seraph)
INSERT INTO vehicles_catalog (id, name, tier, price, speed, armor, image, model_url)
VALUES 
(1, 'Troll Compact S1', 'Starter', 5000, 40, 20, '/assets/cars/troll_compact_s1.png', '/models/vehicles/troll_compact_s1.glb'),
(2, 'Midline XR', 'Mid', 12000, 60, 35, '/assets/cars/midline_xr.png', '/models/vehicles/midline_xr.glb'),
(3, 'Urban Drift R', 'Mid', 18000, 75, 30, '/assets/cars/urban_drift_r.png', '/models/vehicles/urban_drift_r.glb'),
(4, 'Ironclad GT', 'Luxury', 45000, 85, 60, '/assets/cars/ironclad_gt.png', '/models/vehicles/ironclad_gt.glb'),
(5, 'Vanta LX', 'Luxury', 60000, 92, 35, '/assets/cars/vanta_lx.png', '/models/vehicles/vanta_lx.glb'),
(6, 'Phantom X', 'Super', 150000, 110, 40, '/assets/cars/phantom_x.png', '/models/vehicles/phantom_x.glb'),
(7, 'Obsidian One Apex', 'Hyper', 180000, 120, 45, '/assets/cars/vehicle_1_original.png', '/models/vehicles/obsidian_one_apex.glb'),
(8, 'Titan Enforcer', 'Legendary', 500000, 60, 100, '/assets/cars/vehicle_2_original.png', '/models/vehicles/titan_enforcer.glb'),
(9, 'Neon Hatch S', 'Street', 8000, 48, 22, '/assets/cars/vehicle_3_original.png', '/models/vehicles/neon_hatch_s.glb'),
(10, 'Courier Spark Bike', 'Street', 7000, 55, 16, '/assets/cars/vehicle_4_original.png', '/models/vehicles/courier_spark_bike.glb'),
(11, 'Apex Trail SUV', 'Mid', 22000, 70, 45, '/assets/cars/vehicle_5_original.png', '/models/vehicles/apex_trail_suv.glb'),
(12, 'Quantum Veil', 'Super', 220000, 130, 38, '/assets/cars/vehicle_6_original.png', '/models/vehicles/quantum_veil.glb'),
(13, 'Driftline Pulse Bike', 'Mid', 16000, 78, 20, '/assets/cars/vehicle_7_original.png', '/models/vehicles/driftline_pulse_bike.glb'),
(14, 'Regal Meridian', 'Luxury', 85000, 88, 50, '/assets/cars/vehicle_8_original.png', '/models/vehicles/regal_meridian.glb'),
(15, 'Luxe Voyager', 'Luxury', 78000, 86, 32, '/assets/cars/vehicle_1_original.png', '/models/vehicles/luxe_voyager.glb'),
(16, 'Eclipse Seraph', 'Super', 260000, 138, 42, '/assets/cars/vehicle_6_original.png', '/models/vehicles/eclipse_seraph.glb')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    tier = EXCLUDED.tier,
    price = EXCLUDED.price,
    speed = EXCLUDED.speed,
    armor = EXCLUDED.armor,
    image = EXCLUDED.image,
    model_url = EXCLUDED.model_url;

-- Reset sequence to avoid collision if new items are added without ID
SELECT setval('vehicles_catalog_id_seq', (SELECT MAX(id) FROM vehicles_catalog));
