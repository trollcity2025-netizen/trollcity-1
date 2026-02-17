alter table public.user_profiles
add column if not exists ingress_id text,
add column if not exists ingress_room_name text,
add column if not exists ingress_url text,
add column if not exists ingress_updated_at timestamptz;
