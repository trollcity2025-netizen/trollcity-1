-- Add soft delete functionality to messages tables
ALTER TABLE direct_messages 
ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_direct_messages_deleted ON direct_messages(deleted) WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_direct_messages_deleted_at ON direct_messages(deleted_at);

CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(deleted) WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at ON messages(deleted_at);

-- Grant permissions for soft delete operations
GRANT UPDATE ON direct_messages TO authenticated;
GRANT UPDATE ON messages TO authenticated;