-- Fix table permissions for relationship queries
-- Grant SELECT permissions on streams and profiles tables for proper joins

-- Grant SELECT on streams table
GRANT SELECT ON public.streams TO anon, authenticated;

-- Grant SELECT on profiles table  
GRANT SELECT ON public.profiles TO anon, authenticated;

-- Grant SELECT on cashout_requests table
GRANT SELECT ON public.cashout_requests TO anon, authenticated;

-- Grant necessary permissions for relationships
GRANT SELECT ON public.entrance_effects TO anon, authenticated;
GRANT SELECT ON public.user_entrance_effects TO anon, authenticated;
GRANT SELECT ON public.coin_packages TO anon, authenticated;