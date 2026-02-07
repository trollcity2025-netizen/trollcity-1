-- Data Cleanup Migration
-- 1. Clean up existing bad data
UPDATE public.streams 
SET hls_url = NULL, 
    hls_path = NULL 
WHERE hls_url LIKE 'http%';

-- 2. Ensure hls_path is populated correctly where missing but ID is known
-- (Optional: We can populate hls_path for streams that have NULL hls_path but are valid)
-- For now, just cleaning the bad data as requested.

-- 3. Verify no stream rows store full URLs (This is a check, not a change, but good to have as comment)
-- SELECT count(*) FROM streams WHERE hls_url LIKE 'http%'; should be 0.
