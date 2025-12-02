-- Add seen column to messages table for read receipts
ALTER TABLE messages 
  ADD COLUMN IF NOT EXISTS seen BOOLEAN DEFAULT false;

-- Create index for efficient unread queries
CREATE INDEX IF NOT EXISTS idx_messages_unread 
  ON messages(receiver_id, seen) 
  WHERE seen = false AND message_type = 'dm';

-- Update existing messages to be seen (optional - you may want to keep them unread)
-- UPDATE messages SET seen = true WHERE seen IS NULL;

COMMENT ON COLUMN messages.seen IS 'Whether the receiver has seen/read this message';

