-- RLS policies for messages to allow DMs to work

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow users to read messages where they are sender or receiver
CREATE POLICY "messages_select_own" ON messages
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Allow users to insert messages where they are the sender
CREATE POLICY "messages_insert_sender" ON messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Allow receiver to update seen/read flags on their own messages
CREATE POLICY "messages_update_receiver" ON messages
  FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

