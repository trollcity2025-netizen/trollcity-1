-- Enable Supabase Realtime for conversation_messages table
-- This allows real-time subscriptions to work for TCPS messaging

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;

-- Also add conversations table for real-time updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- Add conversation_members for member changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
