-- Fix missing columns for QA stress test

-- Add last_active to user_profiles if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'last_active'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN last_active TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add online_status to user_profiles if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'online_status'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN online_status VARCHAR(50);
    END IF;
END $$;

-- Add is_test_account to user_profiles if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'is_test_account'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN is_test_account BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add recipient_id to messages if not exists (check sender_id exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'recipient_id'
    ) THEN
        -- Add recipient_id column
        ALTER TABLE messages ADD COLUMN recipient_id UUID REFERENCES auth.users(id);
        
        -- Create index
        CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
    END IF;
END $$;

-- Add recipient_id to gifts if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gifts' AND column_name = 'recipient_id'
    ) THEN
        ALTER TABLE gifts ADD COLUMN recipient_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Grant permissions
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON messages TO authenticated;
GRANT ALL ON gifts TO authenticated;

-- Refresh schema cache (this is done via Supabase dashboard usually)
-- For now, just confirm columns are added
SELECT 'Columns added successfully' as status;