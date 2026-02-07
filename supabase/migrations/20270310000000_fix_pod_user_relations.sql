-- Fix relationships to point to public.user_profiles instead of auth.users
-- This allows PostgREST to join these tables with user_profiles to fetch username/avatar

-- 1. pod_rooms
ALTER TABLE public.pod_rooms
DROP CONSTRAINT IF EXISTS pod_rooms_host_id_fkey;

ALTER TABLE public.pod_rooms
ADD CONSTRAINT pod_rooms_host_id_fkey
FOREIGN KEY (host_id)
REFERENCES public.user_profiles(id)
ON DELETE CASCADE;

-- 2. pod_room_participants
ALTER TABLE public.pod_room_participants
DROP CONSTRAINT IF EXISTS pod_room_participants_user_id_fkey;

ALTER TABLE public.pod_room_participants
ADD CONSTRAINT pod_room_participants_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.user_profiles(id)
ON DELETE CASCADE;

-- 3. pod_episodes
ALTER TABLE public.pod_episodes
DROP CONSTRAINT IF EXISTS pod_episodes_host_id_fkey;

ALTER TABLE public.pod_episodes
ADD CONSTRAINT pod_episodes_host_id_fkey
FOREIGN KEY (host_id)
REFERENCES public.user_profiles(id)
ON DELETE SET NULL;

-- 4. pod_bans
ALTER TABLE public.pod_bans
DROP CONSTRAINT IF EXISTS pod_bans_user_id_fkey;

ALTER TABLE public.pod_bans
ADD CONSTRAINT pod_bans_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.user_profiles(id)
ON DELETE CASCADE;

-- 5. pod_chat_messages
ALTER TABLE public.pod_chat_messages
DROP CONSTRAINT IF EXISTS pod_chat_messages_user_id_fkey;

ALTER TABLE public.pod_chat_messages
ADD CONSTRAINT pod_chat_messages_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.user_profiles(id)
ON DELETE CASCADE;
