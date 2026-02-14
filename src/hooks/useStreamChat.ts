import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { ChatMessage } from '../types/broadcast';
import { toast } from 'sonner';

interface VehicleStatus {
  has_vehicle: boolean;
  vehicle_name?: string;
  plate?: string;
  license_status?: string;
  is_suspended?: boolean;
  insurance_active?: boolean;
}

export function useStreamChat(streamId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { user, profile } = useAuthStore();
  const lastSentRef = useRef<number>(0);
  const RATE_LIMIT_MS = 1000;
  
  // Cache for vehicle status
  const [vehicleCache, setVehicleCache] = useState<Record<string, VehicleStatus>>({});

  const fetchVehicleStatus = useCallback(async (userId: string) => {
    if (vehicleCache[userId]) return vehicleCache[userId];
    
    try {
      const { data, error } = await supabase.rpc('get_broadcast_vehicle_status', { target_user_id: userId });
      if (!error && data) {
        setVehicleCache(prev => ({ ...prev, [userId]: data }));
        return data as VehicleStatus;
      }
    } catch (err) {
      console.error('Error fetching vehicle status:', err);
    }
    return null;
  }, [vehicleCache]);

  useEffect(() => {
    if (!streamId) return;

    const fetchMessages = async () => {
        const cutoff = new Date(Date.now() - 25000).toISOString();
        const { data } = await supabase
            .from('stream_messages')
            .select('*, user_profiles(username, avatar_url, role, troll_role, created_at)')
            .eq('stream_id', streamId)
            .gt('created_at', cutoff)
            .order('created_at', { ascending: true });
        
        if (data) {
            const processedMessages = await Promise.all(data.map(async (m: any) => {
                let vStatus = m.vehicle_snapshot as VehicleStatus | undefined;
                
                const uProfile = {
                    username: m.user_name || m.user_profiles?.username || 'Unknown',
                    avatar_url: m.user_avatar || m.user_profiles?.avatar_url || '',
                    role: m.user_role || m.user_profiles?.role,
                    troll_role: m.user_troll_role || m.user_profiles?.troll_role,
                    created_at: m.user_created_at || m.user_profiles?.created_at
                };

                if (!vStatus && !m.vehicle_snapshot) {
                     if (vehicleCache[m.user_id]) {
                         vStatus = vehicleCache[m.user_id];
                     } else {
                         vStatus = await fetchVehicleStatus(m.user_id) || undefined;
                     }
                }

                return {
                    ...m,
                    type: 'chat',
                    user: uProfile, // Map to 'user' for ChatMessage type compatibility if needed, or stick to user_profiles
                    user_profiles: uProfile,
                    vehicle_status: vStatus
                };
            }));
            
            setMessages(processedMessages as ChatMessage[]);
        }
    };

    fetchMessages();

    // Subscribe via Server-Signed Broadcast
    const chatChannel = supabase
        .channel(`stream:${streamId}`)
        .on('broadcast', { event: 'message' }, (payload) => {
            const envelope = payload.payload;
            
            // Check if this is a message for this stream and version 1
            if (envelope.v !== 1 || envelope.stream_id !== streamId) return;

            const newMsg: any = {
                id: envelope.txn_id,
                user_id: envelope.s,
                content: envelope.d.content,
                created_at: new Date(envelope.ts).toISOString(),
                type: 'chat',
                user_profiles: {
                    username: envelope.d.user_name || 'Unknown',
                    avatar_url: envelope.d.user_avatar || '',
                    role: envelope.d.user_role,
                    troll_role: envelope.d.user_troll_role,
                    created_at: envelope.d.user_created_at,
                    rgb_username_expires_at: envelope.d.user_rgb_expires_at,
                    glowing_username_color: envelope.d.user_glowing_username_color
                },
                vehicle_status: envelope.d.vehicle_snapshot
            };

            setMessages(prev => {
                const updated = [...prev, newMsg];
                if (updated.length > 100) return updated.slice(updated.length - 100);
                return updated;
            });
        })
        .subscribe();

    // Subscribe to User Entrance (Presence) - Consistent with BroadcastChat
    const presenceChannel = supabase
        .channel(`room:${streamId}`)
        .on('presence', { event: 'join' }, ({ newPresences }) => {
            newPresences.forEach((p: any) => {
                const systemMsg: ChatMessage = {
                    id: `sys-join-${Date.now()}-${Math.random()}`,
                    stream_id: streamId,
                    user_id: p.user_id,
                    content: 'joined the broadcast',
                    created_at: new Date().toISOString(),
                    type: 'system', 
                    user: {
                        username: p.username || 'Guest',
                        avatar_url: p.avatar_url || ''
                    },
                    user_profiles: {
                        username: p.username || 'Guest',
                        avatar_url: p.avatar_url || '',
                        role: p.role,
                        troll_role: p.troll_role
                    }
                };
                setMessages(prev => [...prev, systemMsg]);
            });
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
            leftPresences.forEach((p: any) => {
                const systemMsg: ChatMessage = {
                    id: `sys-leave-${Date.now()}-${Math.random()}`,
                    stream_id: streamId,
                    user_id: p.user_id,
                    content: 'left the broadcast',
                    created_at: new Date().toISOString(),
                    type: 'system',
                    user: {
                        username: p.username || 'Guest',
                        avatar_url: p.avatar_url || ''
                    },
                    user_profiles: {
                        username: p.username || 'Guest',
                        avatar_url: p.avatar_url || '',
                        role: p.role,
                        troll_role: p.troll_role
                    }
                };
                setMessages(prev => [...prev, systemMsg]);
            });
        })
        .subscribe();

    return () => { 
        supabase.removeChannel(chatChannel); 
        supabase.removeChannel(presenceChannel);
    };
  }, [streamId, fetchVehicleStatus, vehicleCache]);

  const sendMessage = async (content: string) => {
    console.log('💬 [useStreamChat] sendMessage called', { 
      hasContent: !!content.trim(), 
      hasUser: !!user, 
      hasProfile: !!profile,
      streamId 
    });
    
    if (!content.trim()) return;
    
    if (!user || !profile) {
        console.error('💬 [useStreamChat] No user or profile');
        toast.error('You must be logged in to chat');
        return;
    }
    
    const now = Date.now();
    if (now - lastSentRef.current < RATE_LIMIT_MS) {
        console.log('💬 [useStreamChat] Rate limited');
        return;
    }
    lastSentRef.current = now;

    // Optimistic Update
    const txnId = crypto.randomUUID();
    const optimisticMsg: any = {
        id: txnId,
        user_id: user.id,
        content: content.trim(),
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
        },
        vehicle_status: vehicleCache[user.id]
    };

    setMessages(prev => [...prev, optimisticMsg]);

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
                data: { content: content.trim() }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to send message');
        }

        const signedEnvelope = await response.json();
        console.log('💬 [useStreamChat] Message signed and sent:', signedEnvelope);

    } catch (err: any) {
        console.error('💬 [useStreamChat] Error sending message:', err);
        if (String(err.message || '').toLowerCase().includes('rate limit')) {
            toast.error('You are sending messages too fast. Please slow down.');
        } else {
            toast.error('Failed to send message: ' + err.message);
        }
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== txnId));
    }
  };

  return { messages, sendMessage };
}
