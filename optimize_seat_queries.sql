-- Optimize guest box joining performance
-- Add indexes for the most common query patterns in join_seat_atomic and get_stream_seats

-- Index for checking if seat is occupied (stream_id + seat_index + status)
CREATE INDEX IF NOT EXISTS idx_stream_seat_sessions_seat_lookup 
ON public.stream_seat_sessions(stream_id, seat_index, status);

-- Index for checking if user already has a seat in stream (stream_id + user_id + status)
CREATE INDEX IF NOT EXISTS idx_stream_seat_sessions_user_stream 
ON public.stream_seat_sessions(stream_id, user_id, status);

-- Index for checking if guest already has a seat in stream (stream_id + guest_id + status)  
CREATE INDEX IF NOT EXISTS idx_stream_seat_sessions_guest_stream 
ON public.stream_seat_sessions(stream_id, guest_id, status);

-- Composite index for get_stream_seats to speed up the JOIN
CREATE INDEX IF NOT EXISTS idx_stream_seat_sessions_active_lookup
ON public.stream_seat_sessions(stream_id, status, seat_index)
WHERE status = 'active';

-- Analyze tables to update statistics
ANALYZE public.stream_seat_sessions;
ANALYZE public.user_profiles;
