/**
 * Optimized Chat Hook - Uses React Query for instant loading
 * Similar to Facebook Messenger performance
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { useCallback } from 'react';

const CONVERSATIONS_CACHE_KEY = 'tcps_conversations';
const MESSAGES_CACHE_KEY = 'tcps_messages';

// Optimized conversation fetch - fewer queries, more efficient
async function fetchConversations(userId: string) {
  // Single optimized query that fetches conversations with last message and unread count
  const { data: conversations, error } = await supabase
    .rpc('get_user_conversations_optimized', { p_user_id: userId })
    .limit(50);

  if (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }

  return conversations || [];
}

// Fetch messages with sender info in single query
async function fetchMessages(conversationId: string, limit = 50) {
  const { data: messages, error } = await supabase
    .from('conversation_messages')
    .select(`
      id,
      conversation_id,
      sender_id,
      body,
      created_at,
      read_at,
      sender:user_profiles!sender_id(
        id,
        username,
        avatar_url,
        rgb_username_expires_at,
        glowing_username_color,
        created_at
      )
    `)
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }

  return (messages || []).reverse();
}

// Create or get existing conversation
async function getOrCreateConversation(userId: string, otherUserId: string) {
  // First try to find existing conversation
  const { data: existing } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', userId);

  if (existing && existing.length > 0) {
    const convIds = existing.map(c => c.conversation_id);
    
    // Find conversation with the other user
    const { data: shared } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .in('conversation_id', convIds)
      .eq('user_id', otherUserId)
      .limit(1)
      .maybeSingle();

    if (shared?.conversation_id) {
      return { id: shared.conversation_id, is_new: false };
    }
  }

  // Create new conversation
  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({})
    .select()
    .single();

  if (error || !conversation) {
    throw new Error('Failed to create conversation');
  }

  // Add both users to conversation
  await supabase
    .from('conversation_members')
    .insert([
      { conversation_id: conversation.id, user_id: userId },
      { conversation_id: conversation.id, user_id: otherUserId },
    ]);

  return { id: conversation.id, is_new: true };
}

// Send message
async function sendMessage(conversationId: string, senderId: string, content: string) {
  const { data: message, error } = await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: content,
    })
    .select()
    .single();

  if (error) {
    console.error('Error sending message:', error);
    throw error;
  }

  return message;
}

// Mark messages as read
async function markAsRead(conversationId: string, userId: string) {
  await supabase
    .from('conversation_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read_at', null);
}

export function useConversations() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: [CONVERSATIONS_CACHE_KEY, userId],
    queryFn: () => fetchConversations(userId!),
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: false,
  });
}

export function useMessages(conversationId: string | null) {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: [MESSAGES_CACHE_KEY, conversationId],
    queryFn: () => fetchMessages(conversationId!),
    enabled: !!conversationId && !!userId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      if (!userId) throw new Error('Not authenticated');
      return sendMessage(conversationId, userId, content);
    },
    onSuccess: (message) => {
      // Optimistically update messages cache
      queryClient.setQueryData([MESSAGES_CACHE_KEY, message.conversation_id], (old: any[]) => {
        if (!old) return [message];
        return [...old, message];
      });
      
      // Invalidate conversations to update last message
      queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_CACHE_KEY] });
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!userId) throw new Error('Not authenticated');
      return markAsRead(conversationId, userId);
    },
    onSuccess: () => {
      // Invalidate messages to refetch with read status
      queryClient.invalidateQueries({ queryKey: [MESSAGES_CACHE_KEY] });
    },
  });
}

export function useGetOrCreateConversation() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!userId) throw new Error('Not authenticated');
      return getOrCreateConversation(userId, otherUserId);
    },
    onSuccess: () => {
      // Invalidate conversations after creating new one
      queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_CACHE_KEY] });
    },
  });
}

// Prefetch messages for faster navigation
export function usePrefetchMessages() {
  const queryClient = useQueryClient();

  return useCallback((conversationId: string) => {
    queryClient.prefetchQuery({
      queryKey: [MESSAGES_CACHE_KEY, conversationId],
      queryFn: () => fetchMessages(conversationId),
      staleTime: 60 * 1000, // 1 minute
    });
  }, [queryClient]);
}
