-- Add host_user_id foreign key to streams table referencing user_profiles(id)
-- This ensures each stream has a proper reference to its host user

ALTER TABLE public.streams
ADD COLUMN IF NOT EXISTS host_user_id UUID;

-- Add the foreign key constraint
ALTER TABLE public.streams
ADD CONSTRAINT streams_host_user_id_fkey
FOREIGN KEY (host_user_id)
REFERENCES public.user_profiles (id);

-- Optional: Create an index for performance on the foreign key
CREATE INDEX IF NOT EXISTS idx_streams_host_user_id ON public.streams(host_user_id);