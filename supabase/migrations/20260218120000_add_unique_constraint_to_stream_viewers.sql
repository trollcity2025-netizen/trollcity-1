
-- Add a unique constraint to the stream_viewers table to prevent duplicate entries
ALTER TABLE stream_viewers
ADD CONSTRAINT unique_stream_viewer UNIQUE (stream_id, user_id);
