
-- Add hls_url to pod_rooms
ALTER TABLE public.pod_rooms 
ADD COLUMN IF NOT EXISTS hls_url TEXT;

-- Add hls_url to court_sessions
ALTER TABLE public.court_sessions
ADD COLUMN IF NOT EXISTS hls_url TEXT;

-- Update existing records if needed (optional, but good for consistency)
-- For active/live rooms, we can construct the default URL
UPDATE public.pod_rooms
SET hls_url = 'https://cdn.maitrollcity.com/streams/' || id || '.m3u8'
WHERE hls_url IS NULL;

UPDATE public.court_sessions
SET hls_url = 'https://cdn.maitrollcity.com/streams/' || id || '.m3u8'
WHERE hls_url IS NULL;
