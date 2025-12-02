// Fix for chat not sending/showing in broadcast
// Add to StreamRoom.tsx

export const fixChatSend = async (
  message: string,
  streamId: string,
  userId: string,
  supabase: any
) => {
  try {
    // Insert message into chat_messages table
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId,
        stream_id: streamId,
        message: message.trim(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Chat send error:', error);
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('Failed to send chat message:', error);
    throw error;
  }
};

// Also ensure realtime subscription is set up:
export const setupChatRealtime = (
  streamId: string,
  setMessages: (messages: any[]) => void,
  supabase: any
) => {
  const channel = supabase
    .channel(`stream-chat-${streamId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `stream_id=eq.${streamId}`
      },
      (payload: any) => {
        setMessages((prev: any[]) => [...prev, payload.new]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

