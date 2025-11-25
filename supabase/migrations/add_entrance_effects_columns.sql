-- Add missing columns to entrance_effects table
ALTER TABLE entrance_effects 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS rarity TEXT DEFAULT 'COMMON',
ADD COLUMN IF NOT EXISTS image_url TEXT;