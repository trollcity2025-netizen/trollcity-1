-- Migration: Ensure Guest Access for Streams and Podcasts
-- Description: Ensures that unauthenticated (anon) users can view streams, podcasts, and related public data.

-- 1. Streams
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view streams" ON public.streams;
CREATE POLICY "Anyone can view streams" ON public.streams
    FOR SELECT USING (true);

-- 2. Stream Messages (Chat)
ALTER TABLE public.stream_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Stream Messages" ON public.stream_messages;
CREATE POLICY "Public Read Stream Messages" ON public.stream_messages
    FOR SELECT USING (true);

-- 3. Stream Seat Sessions
ALTER TABLE public.stream_seat_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view active seat sessions" ON public.stream_seat_sessions;
CREATE POLICY "Public view active seat sessions" ON public.stream_seat_sessions
    FOR SELECT USING (status = 'active');

-- 4. Pod Rooms
ALTER TABLE public.pod_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active rooms" ON public.pod_rooms;
CREATE POLICY "Anyone can view active rooms" ON public.pod_rooms
    FOR SELECT USING (true);

-- 5. Pod Participants
ALTER TABLE public.pod_room_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read pod participants" ON public.pod_room_participants;
CREATE POLICY "Public read pod participants" ON public.pod_room_participants
    FOR SELECT USING (true);

-- 6. Pod Chat Messages
ALTER TABLE public.pod_chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read pod chat" ON public.pod_chat_messages;
CREATE POLICY "Public read pod chat" ON public.pod_chat_messages
    FOR SELECT USING (true);

-- 7. User Profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view profiles" ON public.user_profiles;
CREATE POLICY "Public view profiles" ON public.user_profiles
    FOR SELECT USING (true);

-- 8. Pod Bans (to check if guest is banned, though usually guests aren't tracked this way)
ALTER TABLE public.pod_bans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can view bans" ON public.pod_bans;
CREATE POLICY "Everyone can view bans" ON public.pod_bans
    FOR SELECT USING (true);

-- 9. Pod Chat Bans
ALTER TABLE public.pod_chat_bans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can view chat bans" ON public.pod_chat_bans;
CREATE POLICY "Everyone can view chat bans" ON public.pod_chat_bans
    FOR SELECT USING (true);

-- Grant SELECT to anon for all these tables
GRANT SELECT ON public.streams TO anon;
GRANT SELECT ON public.stream_messages TO anon;
GRANT SELECT ON public.stream_seat_sessions TO anon;
GRANT SELECT ON public.pod_rooms TO anon;
GRANT SELECT ON public.pod_room_participants TO anon;
GRANT SELECT ON public.pod_chat_messages TO anon;
GRANT SELECT ON public.user_profiles TO anon;
GRANT SELECT ON public.pod_bans TO anon;
GRANT SELECT ON public.pod_chat_bans TO anon;
