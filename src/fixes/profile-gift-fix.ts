// Fix for gift sending from profile
// Add this to Profile.tsx handleSendGift function

export const fixProfileGiftSend = async (
  recipientId: string,
  giftId: string,
  coins: number,
  supabase: any,
  profile: any
) => {
  try {
    // Ensure we have the correct API endpoint
    const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
      'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1';
    
    const response = await fetch(`${edgeFunctionsUrl}/send-gift`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({
        sender_id: profile.id,
        receiver_id: recipientId,
        gift_id: giftId,
        coins_spent: coins,
        stream_id: null // Not in a stream
      })
    });

    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to send gift');
    }

    return data;
  } catch (error: any) {
    console.error('Gift send error:', error);
    throw error;
  }
};

