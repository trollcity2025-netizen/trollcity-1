-- Create chat_messages table for stream chat functionality
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'gift', 'system', 'moderation')),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES auth.users(id),
    is_moderated BOOLEAN DEFAULT FALSE,
    moderation_reason TEXT,
    edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE,
    reply_to UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_stream_id ON public.chat_messages(stream_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_deleted ON public.chat_messages(deleted) WHERE deleted = FALSE;

-- Grant permissions
GRANT SELECT ON public.chat_messages TO anon;
GRANT SELECT ON public.chat_messages TO authenticated;
GRANT INSERT ON public.chat_messages TO authenticated;
GRANT UPDATE ON public.chat_messages TO authenticated;
GRANT DELETE ON public.chat_messages TO authenticated;

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can view chat messages" ON public.chat_messages
    FOR SELECT USING (deleted = FALSE);

CREATE POLICY "Authenticated users can send messages" ON public.chat_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id AND deleted = FALSE);

CREATE POLICY "Users can update their own messages" ON public.chat_messages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages" ON public.chat_messages
    FOR DELETE USING (auth.uid() = user_id);