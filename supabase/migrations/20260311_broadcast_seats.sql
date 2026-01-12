-- Broadcast seat assignments table for Officer Stream
CREATE TABLE IF NOT EXISTS public.broadcast_seats (
  room TEXT NOT NULL,
  seat_index INTEGER NOT NULL CHECK (seat_index BETWEEN 1 AND 6),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  username TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'troll_officer',
  metadata JSONB DEFAULT '{}'::JSONB,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room, seat_index)
);

-- Trigger helper to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.broadcast_seats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_broadcast_seats_updated_at ON public.broadcast_seats;
CREATE TRIGGER set_broadcast_seats_updated_at
BEFORE UPDATE ON public.broadcast_seats
FOR EACH ROW EXECUTE FUNCTION public.broadcast_seats_updated_at();

-- RPC: claim a seat with atomic guard
CREATE OR REPLACE FUNCTION public.claim_broadcast_seat(
  p_room TEXT,
  p_seat_index INTEGER,
  p_user_id UUID,
  p_username TEXT,
  p_avatar_url TEXT,
  p_role TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE (
  room TEXT,
  seat_index INTEGER,
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  role TEXT,
  metadata JSONB,
  assigned_at TIMESTAMPTZ,
  created BOOLEAN,
  is_owner BOOLEAN
) AS $$
DECLARE
  existing_seat public.broadcast_seats%ROWTYPE;
  user_existing_seat public.broadcast_seats%ROWTYPE;
BEGIN
  LOCK public.broadcast_seats IN SHARE ROW EXCLUSIVE MODE;

  -- Check if user already has a seat in this room
  SELECT * INTO user_existing_seat
  FROM public.broadcast_seats bs
  WHERE bs.room = p_room AND bs.user_id = p_user_id
  FOR UPDATE;

  IF FOUND THEN
    -- User already has a seat, return that seat info
    room := user_existing_seat.room;
    seat_index := user_existing_seat.seat_index;
    user_id := user_existing_seat.user_id;
    username := user_existing_seat.username;
    avatar_url := user_existing_seat.avatar_url;
    role := user_existing_seat.role;
    metadata := user_existing_seat.metadata;
    assigned_at := user_existing_seat.assigned_at;
    created := FALSE;
    is_owner := TRUE;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Check if the specific seat is already taken
  SELECT * INTO existing_seat
  FROM public.broadcast_seats bs
  WHERE bs.room = p_room AND bs.seat_index = p_seat_index
  FOR UPDATE;

  IF FOUND THEN
    room := existing_seat.room;
    seat_index := existing_seat.seat_index;
    user_id := existing_seat.user_id;
    username := existing_seat.username;
    avatar_url := existing_seat.avatar_url;
    role := existing_seat.role;
    metadata := existing_seat.metadata;
    assigned_at := existing_seat.assigned_at;
    created := FALSE;
    is_owner := existing_seat.user_id = p_user_id;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Seat is available, claim it
  INSERT INTO public.broadcast_seats AS bs (
    room, seat_index, user_id, username, avatar_url, role, metadata
  ) VALUES (
    p_room, p_seat_index, p_user_id, p_username, p_avatar_url, p_role, COALESCE(p_metadata, '{}'::JSONB)
  )
  RETURNING bs.room, bs.seat_index, bs.user_id, bs.username, bs.avatar_url, bs.role, bs.metadata, bs.assigned_at
  INTO room, seat_index, user_id, username, avatar_url, role, metadata, assigned_at;

  created := TRUE;
  is_owner := TRUE;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- RPC: release a seat
CREATE OR REPLACE FUNCTION public.release_broadcast_seat(
  p_room TEXT,
  p_seat_index INTEGER,
  p_user_id UUID,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  room TEXT,
  seat_index INTEGER,
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  role TEXT,
  metadata JSONB,
  assigned_at TIMESTAMPTZ
) AS $$
DECLARE
  existing public.broadcast_seats%ROWTYPE;
BEGIN
  SELECT * INTO existing
  FROM public.broadcast_seats bs
  WHERE bs.room = p_room AND bs.seat_index = p_seat_index
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT p_force AND existing.user_id <> p_user_id THEN
    RETURN;
  END IF;

  DELETE FROM public.broadcast_seats AS bs
  WHERE bs.room = p_room AND bs.seat_index = p_seat_index
  RETURNING bs.room, bs.seat_index, bs.user_id, bs.username, bs.avatar_url, bs.role, bs.metadata, bs.assigned_at
  INTO room, seat_index, user_id, username, avatar_url, role, metadata, assigned_at;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
