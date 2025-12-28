-- Add support for new message types: dm, system, officer, broadcast
-- Update message_type column to support these new types

-- First, ensure message_type column exists and has the right default
DO $$ 
BEGIN
  -- Add message_type if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'message_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN message_type text DEFAULT 'dm';
  END IF;
END $$;

-- Update existing messages to have 'dm' type if they have sender_id and receiver_id (direct messages)
UPDATE messages 
SET message_type = 'dm' 
WHERE message_type IS NULL 
  AND sender_id IS NOT NULL 
  AND receiver_id IS NOT NULL;

-- Update stream messages to keep 'chat' type
UPDATE messages 
SET message_type = 'chat' 
WHERE message_type IS NULL 
  AND stream_id IS NOT NULL;

-- Add check constraint to allow new message types
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_message_type_check;

ALTER TABLE messages 
ADD CONSTRAINT messages_message_type_check 
CHECK (message_type IN ('chat', 'gift', 'entrance', 'dm', 'system', 'officer', 'broadcast'));

COMMENT ON COLUMN messages.message_type IS 'Message type: dm (direct), system (system alerts), officer (officer messages), broadcast (broadcasts), chat (stream chat), gift, entrance';

