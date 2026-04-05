-- Direct check if jail table exists and has any data
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'jail' AND table_schema = 'public'
) as table_exists;

-- If it exists, try to get any data
SELECT * FROM public.jail LIMIT 1;

-- Check if there's a jail view
SELECT table_name FROM information_schema.views 
WHERE table_name LIKE '%jail%';