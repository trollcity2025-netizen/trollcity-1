# Property Purchase Error Fix

## Problem
Users were getting an error when trying to purchase tiered homes:
```
Failed to purchase tiered home 
{
  code: 'P0001',
  details: null,
  hint: null,
  message: 'Invalid properties.type_id apartment, no matching property_types.id or property_types.type_name'
}
```

## Root Cause
The `properties` table has a `type_id` column with a foreign key constraint:
```sql
type_id TEXT REFERENCES public.property_types(id) DEFAULT 'apartment'
```

When inserting a new property without specifying `type_id`, PostgreSQL uses the default value 'apartment'. However, the `property_types` table was missing the required seed data, causing the foreign key constraint to fail.

## Fix Applied
Created and executed migration `20270328000000_fix_property_types_seed.sql` which:
1. Ensures the `property_types` table exists
2. Inserts/updates all core property types:
   - trailer ($5,000)
   - apartment ($20,000)  
   - house ($100,000)
   - mansion ($1,000,000)
3. Uses `ON CONFLICT DO UPDATE` to safely handle existing records
4. Enables RLS and public read policy

## Verification
Migration executed successfully ✅
Property types verified in database:
- trailer: Trailer ($5000)
- apartment: Apartment ($20000)
- house: House ($100000)
- mansion: Mansion ($1000000)

## Result
Users can now successfully purchase tiered homes. The default `type_id` value 'apartment' now has a valid matching record in `property_types` table.

## Files Changed
- **Created**: `supabase/migrations/20270328000000_fix_property_types_seed.sql`
- **Created**: `apply-property-types-fix.mjs` (migration runner script)

## Technical Notes
The error occurred because:
1. Properties are inserted without explicit `type_id` in `TrollsTownPage.tsx` line 996-1008
2. The column defaults to 'apartment' 
3. Foreign key constraint requires matching record in property_types
4. Previous migrations may have created the column but failed to seed the data
5. This fix ensures the seed data is always present
