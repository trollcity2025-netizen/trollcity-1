-- Fix Eclipse Seraph Image
-- It was incorrectly pointing to vehicle_2_original.png (Titan Enforcer)
-- Setting it to vehicle_6_original.png (matches vehicles.ts, though shared with Quantum Veil)

UPDATE vehicles_catalog
SET image = '/assets/cars/vehicle_6_original.png'
WHERE id = 16 AND name = 'Eclipse Seraph';
