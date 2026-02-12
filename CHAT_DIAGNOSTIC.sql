-- Chat Diagnostic SQL Script
-- Run this in Supabase SQL Editor to diagnose chat issues

-- 1. Check if stream_messages table exists and structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'stream_messages'
ORDER BY ordinal_position;

-- 2. Check RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'stream_messages';

-- 3. Check current RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'stream_messages'
ORDER BY cmd, policyname;

-- 4. Check grants
SELECT 
    grantee,
    privilege_type
FROM information_schema.table_privileges 
WHERE table_schema = 'public' 
AND table_name = 'stream_messages'
AND grantee IN ('authenticated', 'anon', 'public');

-- 5. Check if realtime is enabled
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename = 'stream_messages';

-- 6. Recent messages (last 10)
SELECT 
    id,
    stream_id,
    user_id,
    user_name,
    content,
    created_at,
    (NOW() - created_at) as age
FROM public.stream_messages 
ORDER BY created_at DESC 
LIMIT 10;

-- 7. Count messages per stream
SELECT 
    stream_id,
    COUNT(*) as message_count,
    MAX(created_at) as last_message
FROM public.stream_messages 
GROUP BY stream_id 
ORDER BY last_message DESC;

-- 8. Test INSERT permission (will show error if blocked)
-- Replace 'your-stream-id' with an actual stream ID
DO $$
DECLARE
    v_stream_id UUID := 'your-stream-id'::UUID; -- CHANGE THIS
    v_test_msg_id UUID;
BEGIN
    -- Try to insert a test message
    INSERT INTO public.stream_messages (
        stream_id,
        user_id,
        content,
        user_name
    ) VALUES (
        v_stream_id,
        auth.uid(),
        'SQL Test Message - ' || NOW()::TEXT,
        'SQL Tester'
    )
    RETURNING id INTO v_test_msg_id;
    
    RAISE NOTICE 'SUCCESS: Test message inserted with ID: %', v_test_msg_id;
    
    -- Clean up test message
    DELETE FROM public.stream_messages WHERE id = v_test_msg_id;
    RAISE NOTICE 'Test message cleaned up';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR: %', SQLERRM;
END $$;

-- 9. Check auth.uid() is working
SELECT 
    auth.uid() as current_user_id,
    CASE 
        WHEN auth.uid() IS NULL THEN 'NOT AUTHENTICATED'
        ELSE 'AUTHENTICATED'
    END as status;

-- 10. If there are NO policies at all, this is the problem!
-- Count should be at least 2 (SELECT and INSERT)
SELECT COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'stream_messages';
