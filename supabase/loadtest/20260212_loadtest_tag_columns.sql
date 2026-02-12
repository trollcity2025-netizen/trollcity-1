DO $$
BEGIN
  -- user_profiles tagging
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'run_id') THEN
    ALTER TABLE public.user_profiles ADD COLUMN run_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'source') THEN
    ALTER TABLE public.user_profiles ADD COLUMN source TEXT;
  END IF;

  -- streams tagging
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'run_id') THEN
    ALTER TABLE public.streams ADD COLUMN run_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'source') THEN
    ALTER TABLE public.streams ADD COLUMN source TEXT;
  END IF;

  -- battles tagging
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battles' AND column_name = 'run_id') THEN
    ALTER TABLE public.battles ADD COLUMN run_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battles' AND column_name = 'source') THEN
    ALTER TABLE public.battles ADD COLUMN source TEXT;
  END IF;

  -- stream_participants tagging
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_participants' AND column_name = 'run_id') THEN
    ALTER TABLE public.stream_participants ADD COLUMN run_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_participants' AND column_name = 'source') THEN
    ALTER TABLE public.stream_participants ADD COLUMN source TEXT;
  END IF;

  -- stream_messages tagging
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_messages' AND column_name = 'run_id') THEN
    ALTER TABLE public.stream_messages ADD COLUMN run_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_messages' AND column_name = 'source') THEN
    ALTER TABLE public.stream_messages ADD COLUMN source TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_run_id ON public.user_profiles(run_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_source ON public.user_profiles(source);
CREATE INDEX IF NOT EXISTS idx_streams_run_id ON public.streams(run_id);
CREATE INDEX IF NOT EXISTS idx_streams_source ON public.streams(source);
CREATE INDEX IF NOT EXISTS idx_battles_run_id ON public.battles(run_id);
CREATE INDEX IF NOT EXISTS idx_battles_source ON public.battles(source);
CREATE INDEX IF NOT EXISTS idx_stream_participants_run_id ON public.stream_participants(run_id);
CREATE INDEX IF NOT EXISTS idx_stream_participants_source ON public.stream_participants(source);
CREATE INDEX IF NOT EXISTS idx_stream_messages_run_id ON public.stream_messages(run_id);
CREATE INDEX IF NOT EXISTS idx_stream_messages_source ON public.stream_messages(source);
