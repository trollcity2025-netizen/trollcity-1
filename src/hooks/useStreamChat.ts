import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { generateUUID } from '../lib/uuid';
import { toast } from 'sonner';

export interface Message {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  type?: 'chat' | 'system' | 'gift';
  gift_type?: string;
  gift_amount?: number;
  sender_name?: string;
  user_name?: string;
  user_avatar?: string;
  user_role?: string;
  user_troll_role?: string;
  user_created_at?: string;
  user_rgb_expires_at?: string;
  user_glowing_username_color?: string;
  user_profiles?: {
    username: string;
    avatar_url: string;
    role?: string;
    troll_role?: string;
    created_at?: string;
    rgb_username_expires_at?: string;
    glowing_username_color?: string;
  } | null;
}

interface UseStreamChatProps {
  streamId: string;
  hostId: string;
  isHost: boolean;
}

const MAX_MESSAGES = 200; // Max messages to keep in state
const AUTO_DELETE_INTERVAL = 5000; // Check every 5 seconds for messages to delete
const MESSAGE_LIFETIME_MS = 30000; // Messages disappear after 30 seconds

export const useStreamChat = ({ streamId, hostId, isHost }: UseStreamChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hostChatDisabledByOfficer, setHostChatDisabledByOfficer] = useState(false);
  const { user, profile } = useAuthStore();
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  // Track processed message IDs to prevent duplicates from broadcast + postgres_changes
  const processedMessageIds = useRef<Set<string>>(new Set());

  // Fetch Stream Mods (simplified for now, BroadcastChat had this but it might not be needed for overlay)
  const [streamMods, setStreamMods] = useState<string[]>([]);
  useEffect(() => {
      const fetchMods = async () => {
          const { data } = await supabase
            .from('stream_moderators')
            .select('user_id')
            .eq('broadcaster_id', hostId);
          if (data) setStreamMods(data.map(d => d.user_id));
      };
      if (hostId) fetchMods();
  }, [hostId]);

  // Host Chat Disabled by Officer state
  useEffect(() => {
    if (!hostId) return;

    let mounted = true;
    const fetchHostModerationState = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('broadcast_chat_disabled')
        .eq('id', hostId)
        .maybeSingle();

      if (mounted) {
        setHostChatDisabledByOfficer(!!data?.broadcast_chat_disabled);
      }
    };

    fetchHostModerationState();

    const moderationChannel = supabase
      .channel(`host-chat-lock:${hostId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${hostId}`
        },
        (payload: any) => {
          setHostChatDisabledByOfficer(!!payload?.new?.broadcast_chat_disabled);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(moderationChannel);
    };
  }, [hostId]);

  // Initial fetch and Realtime Subscriptions
  useEffect(() => {
    if (!streamId) return;

    // Initial fetch of messages (last 50)
    const fetchMessages = async () => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 400)); // Jitter

      const { data } = await supabase
        .from('stream_messages')
        .select('*, user_profiles(username, avatar_url, role, troll_role, created_at, rgb_username_expires_at, glowing_username_color)')
        .eq('stream_id', streamId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (data) {
        const processedMessages = data.reverse().map((m: any) => {
          const uProfile = {
            username: m.user_name || m.user_profiles?.username || 'Unknown',
            avatar_url: m.user_avatar || m.user_profiles?.avatar_url || '',
            role: m.user_role || m.user_profiles?.role,
            troll_role: m.user_troll_role || m.user_profiles?.troll_role,
            created_at: m.user_created_at || m.user_profiles?.created_at,
            rgb_username_expires_at: m.user_rgb_expires_at || m.user_profiles?.rgb_username_expires_at,
            glowing_username_color: m.user_glowing_username_color || m.user_profiles?.glowing_username_color
          };
          // Track IDs to prevent duplicates
          if (m.id) processedMessageIds.current.add(m.id);
          return { ...m, type: 'chat', user_profiles: uProfile } as Message;
        });
        
        setMessages(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newHistory = processedMessages.filter(m => !existingIds.has(m.id));
          return [...newHistory, ...prev];
        });
      }
    };
    fetchMessages();

    // Broadcast channel for INSTANT message delivery (primary delivery mechanism)
    const broadcastChannel = supabase
      .channel(`stream-chat:${streamId}`)
      .on(
        'broadcast',
        { event: 'chat' },
        (payload: any) => {
          const msg = payload.payload as Message;
          
          // Skip our own messages (already shown via optimistic update)
          if (msg.user_id === user?.id) return;
          
          // Deduplicate using txn_id and message id
          if (msg.txn_id && processedMessageIds.current.has(msg.txn_id)) return;
          if (msg.id && processedMessageIds.current.has(msg.id)) return;
          
          if (msg.txn_id) processedMessageIds.current.add(msg.txn_id);
          if (msg.id) processedMessageIds.current.add(msg.id);
          
          // Add directly to state for instant display
          setMessages(prev => {
            // Check for duplicates in current state
            if (msg.txn_id && prev.some(m => m.txn_id === msg.txn_id)) return prev;
            if (msg.id && prev.some(m => m.id === msg.id)) return prev;
            
            const updated = [...prev, msg];
            if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
            return updated;
          });
        }
      )
      .subscribe();

    // Postgres Changes as backup (in case broadcast fails)
    const chatChannel = supabase
      .channel(`stream-chat-db-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_messages',
          filter: `stream_id=eq.${streamId}`
        },
        async (payload: any) => {
          const newMessage = payload.new;

          // Skip our own messages
          if (newMessage.user_id === user?.id) return;
          
          // Deduplicate - if already received via broadcast, skip
          if (newMessage.id && processedMessageIds.current.has(newMessage.id)) return;
          if (newMessage.txn_id && processedMessageIds.current.has(newMessage.txn_id)) return;

          // Fetch user profile for the message
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('username, avatar_url, role, troll_role, created_at, rgb_username_expires_at, glowing_username_color')
            .eq('id', newMessage.user_id)
            .single();

          const newMsg: Message = {
            ...newMessage,
            type: 'chat',
            user_profiles: profileData,
          };
          
          if (newMessage.id) processedMessageIds.current.add(newMessage.id);

          // Add directly to state
          setMessages(prev => {
            if (newMessage.id && prev.some(m => m.id === newMessage.id)) return prev;
            const updated = [...prev, newMsg];
            if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
            return updated;
          });
        }
      )
      .subscribe();

    // Track which users have join messages shown (to prevent duplicates)
    const joinedUsersRef = useRef<Set<string>>(new Set());

    // Presence Channel for join/leave messages
    const presenceChannel = supabase
      .channel(`stream:${streamId}`)
      .on('presence', { event: 'join' }, ({ newPresences }) => {
          newPresences.forEach((p: any) => {
              // Skip our own user
              if (p.user_id === user?.id) return;
              // Skip if we already showed a join for this user
              if (joinedUsersRef.current.has(p.user_id)) return;
              joinedUsersRef.current.add(p.user_id);

              const systemMsg: Message = {
                  id: `sys-join-${p.user_id}-${Date.now()}`,
                  user_id: p.user_id,
                  content: 'joined the broadcast',
                  created_at: new Date().toISOString(),
                  type: 'system',
                  user_profiles: {
                      username: p.username || 'Guest',
                      avatar_url: p.avatar_url || '',
                      created_at: p.joined_at,
                      role: p.role,
                      troll_role: p.troll_role
                  }
              };
              setMessages(prev => {
                  const updated = [...prev, systemMsg];
                  if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
                  return updated;
              });
          });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          leftPresences.forEach((p: any) => {
              // Skip our own user
              if (p.user_id === user?.id) return;
              // Only show leave if we showed a join for this user
              if (!joinedUsersRef.current.has(p.user_id)) return;
              joinedUsersRef.current.delete(p.user_id);

              const systemMsg: Message = {
                  id: `sys-leave-${p.user_id}-${Date.now()}`,
                  user_id: p.user_id,
                  content: 'left the broadcast',
                  created_at: new Date().toISOString(),
                  type: 'system',
                  user_profiles: {
                      username: p.username || 'Guest',
                      avatar_url: p.avatar_url || '',
                      created_at: p.joined_at,
                      role: p.role,
                      troll_role: p.troll_role
                  }
              };
              setMessages(prev => {
                  const updated = [...prev, systemMsg];
                  if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
                  return updated;
              });
          });
      })
      .subscribe();

    // Auto-delete messages
    const autoDeleteInterval = setInterval(() => {
        const now = Date.now();
        setMessages(prev => prev.filter(msg => {
            const messageAge = now - new Date(msg.created_at).getTime();
            return messageAge < MESSAGE_LIFETIME_MS;
        }));
    }, AUTO_DELETE_INTERVAL);

    return () => {
      clearInterval(autoDeleteInterval);
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [streamId, user?.id]);

  const sendMessage = useCallback(async (content: string) => {
    if (!user || !profile) {
        toast.error('You must be logged in to send messages.');
        return;
    }
    if (!content.trim()) {
        return;
    }
    if (hostChatDisabledByOfficer) {
        toast.error('Chat is disabled for this broadcaster by officer control');
        return;
    }

    setIsSendingMessage(true);

    const txnId = generateUUID();
    const optimisticMessage: Message = {
        id: `temp-${txnId}`,
        user_id: user.id,
        content,
        created_at: new Date().toISOString(),
        type: 'chat',
        user_profiles: {
            username: profile.username,
            avatar_url: profile.avatar_url,
            role: profile.role,
            troll_role: profile.troll_role,
            created_at: profile.created_at,
            rgb_username_expires_at: profile.rgb_username_expires_at,
            glowing_username_color: profile.glowing_username_color
        }
    };

    setMessages(prev => {
        const updated = [...prev, optimisticMessage];
        if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
        return updated;
    });
    
    // Track ID to prevent duplicates when received via broadcast/postgres
    processedMessageIds.current.add(txnId);

    // Broadcast for instant delivery to all viewers
    const broadcastCh = supabase.channel(`stream-chat:${streamId}`);
    broadcastCh.send({
        type: 'broadcast',
        event: 'chat',
        payload: optimisticMessage
    }).catch(err => {
        console.warn('[useStreamChat] Broadcast send failed:', err);
    });

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const response = await fetch(`${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/send-message`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'chat',
                stream_id: streamId,
                txn_id: txnId,
                data: { content }
            })
        });

        const contentType = response.headers.get('content-type') || '';
        const rawText = await response.text();
        const hasJsonBody = contentType.toLowerCase().includes('application/json') && rawText.trim().length > 0;
        const parsedBody = hasJsonBody ? JSON.parse(rawText) : undefined;

        if (!response.ok) {
            const msg = (parsedBody as any)?.error || (parsedBody as any)?.message || rawText || response.statusText;
            throw new Error(`Failed to send message (${response.status}): ${msg}`);
        }

    } catch (err: any) {
        console.error('Error sending message:', err);
        if (String(err.message || '').toLowerCase().includes('rate limit')) {
            toast.error('You are sending messages too fast. Please slow down.');
        } else {
            toast.error('Failed to send message: ' + err.message);
        }
        setMessages(prev => prev.filter(m => m.id !== `temp-${txnId}`));
    } finally {
        setIsSendingMessage(false);
    }
  }, [user, profile, streamId, hostChatDisabledByOfficer]);

  return {
      messages: messages.filter(msg => {
        // Only show chat and system messages for floating overlay for now
        return msg.type === 'chat' || msg.type === 'system';
      }),
      sendMessage,
      hostChatDisabledByOfficer,
      streamMods,
      isSendingMessage,
      // user, profile // Pass user/profile if needed for rendering within overlay
    };
};
