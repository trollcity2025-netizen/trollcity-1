-- Add read_at column to messages table for read receipts
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Create index for faster queries on unread messages
CREATE INDEX IF NOT EXISTS idx_messages_read_at 
  ON messages(receiver_id, read_at) 
  WHERE read_at IS NULL AND message_type = 'dm';

-- Comment for documentation
COMMENT ON COLUMN messages.read_at IS 'Timestamp when the receiver read/seen this message';

