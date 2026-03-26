-- Group Chat Support Migration
-- Adds is_group, name columns to conversations table and status column to conversation_members

-- Add group chat columns to conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS group_avatar_url TEXT;

-- Add status column to conversation_members for invite flow
-- Status: 'active' (default for existing), 'invited' (pending invite)
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Update existing members to have 'active' status
UPDATE conversation_members SET status = 'active' WHERE status IS NULL;

-- Add index for group chat queries
CREATE INDEX IF NOT EXISTS idx_conversations_is_group ON conversations(is_group) WHERE is_group = TRUE;
CREATE INDEX IF NOT EXISTS idx_conversation_members_status ON conversation_members(status);
