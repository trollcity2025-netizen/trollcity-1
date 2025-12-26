# Fix Entrance Effects, Insurance & Perks

## Two Files Created:

### 1. **FIX_ENTRANCE_EFFECTS_INSURANCE_PERKS.sql** (Run This First)
Complete fix for all tables and data. Includes:
- Drops and recreates: entrance_effects, user_entrance_effects, perks, user_perks, insurance_options, user_insurances
- Adds proper foreign key constraints
- Sets up RLS policies
- Seeds all 20 entrance effects (e1-e20)
- Seeds all perks
- Seeds all insurance options

### 2. **FIX_USER_ENTRANCE_EFFECTS_FK.sql** (Optional - If First File Fails)
Standalone fix just for user_entrance_effects table if the main file doesn't work.

## Instructions:

### Step 1: Run Main Fix (Supabase Dashboard)
1. Go to **Supabase Dashboard** → Your Project
2. Click **SQL Editor** (left sidebar)
3. Click **+ New Query**
4. Copy the entire contents of `FIX_ENTRANCE_EFFECTS_INSURANCE_PERKS.sql`
5. Paste into the SQL Editor
6. Click **Run** (or Cmd/Ctrl + Enter)
7. Verify: You should see results showing ~20 entrance effects, ~10 perks, ~5 insurance options

### Step 2: Done!
The foreign key error will now be fixed. Users can purchase entrance effects without FK constraint violations.

## Verification Query:
After running, execute this to verify all data:
```sql
SELECT 'entrance_effects' as table_name, COUNT(*) FROM entrance_effects
UNION ALL
SELECT 'user_entrance_effects', COUNT(*) FROM user_entrance_effects
UNION ALL
SELECT 'perks', COUNT(*) FROM perks
UNION ALL
SELECT 'user_perks', COUNT(*) FROM user_perks
UNION ALL
SELECT 'insurance_options', COUNT(*) FROM insurance_options
UNION ALL
SELECT 'user_insurances', COUNT(*) FROM user_insurances;
```

## What Changed:

### Table: `entrance_effects`
- Added `image_url` column for effect images
- Removed strict rarity constraint to allow all rarity levels
- Now has proper structure for e1-e20 effects

### Table: `user_entrance_effects`
- **Fixed**: Added foreign key constraint to entrance_effects(id)
- Now properly validates effect_id exists in entrance_effects table
- Prevents FK violations when purchasing

### Data Seeded:
- **20 Entrance Effects**: Classic through World Domination
- **10 Perks**: Visibility, chat, protection, boost, cosmetic perks
- **5 Insurance Options**: Bankrupt/Kick/Full protection for 24h and 1 week

## If You Get Errors:

### Error: "Table entrance_effects already exists"
- The tables were partially created. The SQL includes DROP CASCADE, so it removes conflicts
- If you still get errors, run `FIX_USER_ENTRANCE_EFFECTS_FK.sql` separately

### Error: "Invalid rarity value"
- The constraint was removed. Old data with different rarity values is now accepted

### FK Constraint Still Failing After Running?
- Your database might have old effect_id values that don't exist
- Run this cleanup query first:
```sql
DELETE FROM user_entrance_effects WHERE effect_id NOT IN (SELECT id FROM entrance_effects);
```

## Complete Success Indicators:
✅ No FK constraint errors
✅ All entrance effect records show in database
✅ Users can purchase effects (e1-e20)
✅ Insurance and perks tables exist with data
