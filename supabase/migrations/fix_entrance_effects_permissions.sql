-- Fix permissions for entrance_effects table
GRANT SELECT ON entrance_effects TO anon;
GRANT SELECT ON entrance_effects TO authenticated;

-- Fix permissions for user_entrance_effects table
GRANT ALL PRIVILEGES ON user_entrance_effects TO authenticated;
GRANT SELECT ON user_entrance_effects TO anon;

-- Fix permissions for coin_packages table
GRANT SELECT ON coin_packages TO anon;
GRANT SELECT ON coin_packages TO authenticated;

-- Check current permissions
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND grantee IN ('anon', 'authenticated') 
AND table_name IN ('entrance_effects', 'user_entrance_effects', 'coin_packages')
ORDER BY table_name, privilege_type;