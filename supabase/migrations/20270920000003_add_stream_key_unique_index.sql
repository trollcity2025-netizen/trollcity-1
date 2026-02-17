create unique index if not exists idx_user_profiles_stream_key_unique
on public.user_profiles (stream_key)
where stream_key is not null;
