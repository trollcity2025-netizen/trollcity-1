import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import {
  MessageCircle,
  Loader,
  Send,
  Check,
  CheckCheck,
  AlertCircle,
} from 'lucide-react';
import {
  getConversationMessages,
  sendConversationMessage,
  getOrCreateDirectConversation,
  canUserMessageTarget,
  markMessageAsRead,
  setTypingStatus,
  getUserForMessaging,
  getUserConversationsWithDetails,
  searchUsers,
} from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface Conversation {
  id: string;
  lastMessage?: any;
  otherUsers: any[];
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at?: string | null;
}

interface TypingUser {
  user_id: string;
  username: string;
}

export default function TCPS() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get('user');
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(
    searchParams.get('conversation') || null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [messageCost, setMessageCost] = useState(0);
  const [canMessage, setCanMessage] = useState(true);
  const [messagingError, setMessagingError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [searchUserText, setSearchUserText] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Deduplicate and filter conversations to DM-only
  const dedupConversations = (convs: Conversation[]) => {
    // Client-side safety net: ensure no duplicates by conversation id
    const byId = new Map<string, Conversation>();
    
    for (const row of convs) {
      const prev = byId.get(row.id);
      if (!prev) {
        byId.set(row.id, row);
        continue;
      }

      // Merge otherUsers unique by id
      const mergedUsers = new Map(prev.otherUsers.map((u: any) => [u.id, u]));
      row.otherUsers.forEach((u: any) => mergedUsers.set(u.id, u));

      // Choose newest lastMessage
      const bestLast =
        !prev.lastMessage ? row.lastMessage :
        !row.lastMessage ? prev.lastMessage :
        new Date(row.lastMessage.created_at).getTime() > new Date(prev.lastMessage.created_at).getTime()
          ? row.lastMessage
          : prev.lastMessage;

      byId.set(row.id, { ...prev, otherUsers: [...mergedUsers.values()], lastMessage: bestLast });
    }

    // Filter to DM-only conversations (direct messages with one other user)
    const dmOnly = [...byId.values()].filter((c) => c.otherUsers?.length === 1);
    
    // Deduplicate by unique user: keep only one conversation per user (the one with newest message)
    const byUserId = new Map<string, Conversation>();
    for (const conv of dmOnly) {
      const userId = conv.otherUsers[0]?.id;
      if (!userId) continue;
      
      const existing = byUserId.get(userId);
      if (!existing) {
        byUserId.set(userId, conv);
      } else {
        // Keep conversation with more recent message
        const existingTime = new Date(existing.lastMessage?.created_at ?? 0).getTime();
        const convTime = new Date(conv.lastMessage?.created_at ?? 0).getTime();
        if (convTime > existingTime) {
          byUserId.set(userId, conv);
        }
      }
    }
    
    // Sort by newest message first
    return [...byUserId.values()].sort((a, b) => {
      const aTime = new Date(a.lastMessage?.created_at ?? 0).getTime();
      const bTime = new Date(b.lastMessage?.created_at ?? 0).getTime();
      return bTime - aTime;
    });
  };

  // Load conversations
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadConversations = async () => {
      try {
        const convs = await getUserConversationsWithDetails();
        // Diagnostic logging
        console.log('TCPS convs raw:', convs);
        console.log('TCPS conv ids:', convs.map((c: any) => c.id));
        console.log('TCPS conv count:', convs.length);
        convs.forEach((c: any, i: number) => {
          console.log(`Conv ${i}: id=${c.id}, otherUsers=${c.otherUsers?.map((u: any) => u.username).join(',')}`);
        });
        if (isMounted) {
          const dedupedConvs = dedupConversations(convs);
          setConversations(dedupedConvs);
          setLoading(false);

          // If target user in params, create/find conversation
          if (targetUserId && isMounted) {
            try {
              const convId = await getOrCreateDirectConversation(targetUserId);
              if (isMounted) setSelectedConvId(convId);
            } catch (err) {
              console.error('Failed to create conversation:', err);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load conversations:', err);
        if (isMounted) setLoading(false);
      }
    };

    loadConversations();

    return () => {
      isMounted = false;
    };
  }, [user?.id, targetUserId]);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConvId || !user?.id) return;

    let cancelled = false;
    const unreadMsgIds: string[] = [];

    const loadMessagesAndSetup = async () => {
      try {
        // Load messages and sort oldest to newest
        const msgs = await getConversationMessages(selectedConvId, {
          limit: 100,
        });
        
        if (cancelled) return;
        
        // Sort by created_at ascending (oldest first)
        const sortedMsgs = msgs.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setMessages(sortedMsgs);

        // Collect unread messages to mark all at once
        for (const msg of sortedMsgs) {
          if (!msg.read_at && msg.sender_id !== user.id) {
            unreadMsgIds.push(msg.id);
          }
        }

        // Mark all unread messages as read in one operation
        if (unreadMsgIds.length > 0 && !cancelled) {
          try {
            await supabase
              .from('conversation_messages')
              .update({ read_at: new Date().toISOString() })
              .in('id', unreadMsgIds);
          } catch (err) {
            console.error('Failed to mark messages as read:', err);
          }
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    };

    loadMessagesAndSetup();

    // Subscribe to new messages
    const channel = supabase
      .channel(`conversation:${selectedConvId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${selectedConvId}`,
        },
        (payload) => {
          if (cancelled) return;
          const newMsg = payload.new as Message;
          
          // Append in order (trust Supabase ordering)
          setMessages((prev) => [...prev, newMsg]);

          // Update last message in sidebar and re-sort conversations
          setConversations((prev) => {
            const updated = prev.map((c) =>
              c.id === selectedConvId ? { ...c, lastMessage: newMsg } : c
            );
            // Re-sort by newest message
            return updated.sort((a, b) => {
              const aTime = new Date(a.lastMessage?.created_at ?? 0).getTime();
              const bTime = new Date(b.lastMessage?.created_at ?? 0).getTime();
              return bTime - aTime;
            });
          });

          // Mark as read if from other user
          if (newMsg.sender_id !== user?.id) {
            markMessageAsRead(newMsg.id).catch(console.error);
          }

          scrollToBottom();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${selectedConvId}`,
        },
        (payload) => {
          if (cancelled) return;
          const updatedMsg = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
          );
        }
      )
      .subscribe();

    // Subscribe to typing indicators
    const typingChannel = supabase
      .channel(`typing:${selectedConvId}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'typing_statuses',
          filter: `conversation_id=eq.${selectedConvId}`,
        },
        (payload) => {
          if (cancelled) return;
          const deletedUserId = (payload.old as any).user_id;
          setTypingUsers((prev) =>
            prev.filter((u) => u.user_id !== deletedUserId)
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'typing_statuses',
          filter: `conversation_id=eq.${selectedConvId}`,
        },
        (payload) => {
          if (cancelled) return;
          const typingUser = (payload.new as any).user_id;
          if (typingUser !== user?.id) {
            getUserForMessaging(typingUser).then((userData) => {
              if (!cancelled) {
                setTypingUsers((prev) => [
                  ...prev.filter((u) => u.user_id !== typingUser),
                  { user_id: typingUser, username: userData?.username },
                ]);
              }
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'typing_statuses',
          filter: `conversation_id=eq.${selectedConvId}`,
        },
        (payload) => {
          if (cancelled) return;
          const updatedTyping = (payload.new as any);
          if (!updatedTyping.is_typing) {
            // User stopped typing - remove them
            setTypingUsers((prev) =>
              prev.filter((u) => u.user_id !== updatedTyping.user_id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      channel.unsubscribe();
      typingChannel.unsubscribe();
    };
  }, [selectedConvId, user?.id]);

  // Check messaging permissions (separate effect)
  useEffect(() => {
    if (!selectedConvId || !user?.id || conversations.length === 0) return;

    let cancelled = false;

    const conv = conversations.find((c) => c.id === selectedConvId);
    if (!conv?.otherUsers?.length) return;

    (async () => {
      try {
        const otherUser = conv.otherUsers[0];
        const { canMessage: canMsg, messageCost: cost, reason } =
          await canUserMessageTarget(otherUser.id);

        if (cancelled) return;

        setCanMessage(canMsg);
        setMessageCost(cost);
        setMessagingError(!canMsg && reason ? reason : null);
      } catch (err) {
        if (!cancelled) {
          console.error('Permission check failed:', err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedConvId, user?.id, conversations]);

  // Search users
  useEffect(() => {
    if (!searchUserText || searchUserText.length < 2) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const results = await searchUsers({ query: searchUserText });
        if (!cancelled) {
          // Filter out users already in conversations
          const existingUserIds = new Set(
            conversations.flatMap((c) => c.otherUsers.map((u: any) => u.id))
          );
          const filtered = results.filter((u) => !existingUserIds.has(u.id));
          setSearchResults(filtered);
        }
      } catch (err) {
        console.error('Search failed:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchUserText, conversations]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleStartConversation = async (userId: string) => {
    try {
      const convId = await getOrCreateDirectConversation(userId);
      
      // Reload conversations to ensure the new one appears in the list
      const convs = await getUserConversationsWithDetails();
      if (convs && convs.length > 0) {
        const dedupedConvs = dedupConversations(convs);
        setConversations(dedupedConvs);
      }
      
      setSelectedConvId(convId);
      setSearchUserText('');
      setSearchResults([]);
    } catch (err) {
      console.error('Failed to start conversation:', err);
      toast.error('Failed to start conversation');
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleTyping = useCallback(() => {
    if (!selectedConvId || !user?.id) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      setTypingStatus(selectedConvId, true).catch(console.error);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      setTypingStatus(selectedConvId, false).catch(console.error);
    }, 3000);
  }, [selectedConvId, user?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedConvId || !canMessage) return;

    try {
      // Stop typing
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      isTypingRef.current = false;
      await setTypingStatus(selectedConvId, false).catch(() => {});

      // Send message immediately
      await sendConversationMessage(selectedConvId, messageText.trim());
      setMessageText('');
      setMessagingError(null);
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessagingError('Failed to send message');
      toast.error('Failed to send message');
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="animate-spin" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <MessageCircle size={48} className="text-gray-400" />
        <p className="text-gray-600">Please log in to access TCPS</p>
      </div>
    );
  }

  const selectedConv = conversations.find((c) => c.id === selectedConvId);
  // Conversations are already filtered to DM-only and deduplicated
  const validConversations = conversations;

  return (
    <div className="h-screen w-full flex bg-background">
      {/* Conversations List */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-lg mb-3">Messages</h2>
          <input
            type="text"
            placeholder="Search users..."
            value={searchUserText}
            onChange={(e) => setSearchUserText(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {searchUserText && searchResults.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                Search Results
              </div>
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleStartConversation(user.id)}
                  className="w-full p-3 border-b border-gray-200 dark:border-gray-800 text-left transition-colors hover:bg-green-50 dark:hover:bg-green-900/20"
                >
                  <div className="font-medium truncate text-green-600 dark:text-green-400">
                    + Start chat with {user.username}
                  </div>
                </button>
              ))}
            </>
          )}

          {validConversations.length === 0 && !searchUserText ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No conversations yet. Search for a user to start messaging.
            </div>
          ) : (
            <>
              {validConversations.length > 0 && (
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                  Conversations
                </div>
              )}
              {validConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`w-full p-3 border-b border-gray-200 dark:border-gray-800 text-left transition-colors ${
                    selectedConvId === conv.id
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <div className="font-medium truncate">
                        {conv.otherUsers
                          .map((u: any) => u?.username || 'Unknown')
                          .join(', ') || 'Conversation'}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {conv.lastMessage
                          ? new Date(conv.lastMessage.created_at).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'No messages'}
                      </div>
                    </div>
                    {!conv.lastMessage?.read_at && conv.lastMessage?.sender_id !== user?.id && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col">
        {selectedConv && selectedConv.otherUsers && selectedConv.otherUsers.length > 0 ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="font-semibold">
                    {selectedConv.otherUsers.map((u) => u.username).join(', ')}
                  </h3>
                  {messageCost > 0 && (
                    <p className="text-xs text-amber-600">
                      Messages cost: {messageCost} coins
                    </p>
                  )}
                </div>
              </div>
              {messagingError && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 flex items-center gap-2">
                  <AlertCircle size={14} />
                  {messagingError}
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <MessageCircle size={32} className="text-gray-300 mr-2" />
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender_id === user.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        msg.sender_id === user.id
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      <p className="break-words">{msg.body}</p>
                      <div className="text-xs mt-1 flex items-center gap-1">
                        {msg.sender_id === user.id ? (
                          <>
                            <span className="opacity-70">
                              {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {msg.read_at ? (
                              <CheckCheck size={12} className="opacity-70" />
                            ) : (
                              <Check size={12} className="opacity-70" />
                            )}
                          </>
                        ) : (
                          <span className="opacity-70">
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Typing Indicator */}
              {typingUsers.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    />
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    />
                  </div>
                  {typingUsers.map((u) => u.username).join(', ')} typing...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form
              ref={formRef}
              onSubmit={handleSendMessage}
              className="p-4 border-t border-gray-200 dark:border-gray-800"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => {
                    setMessageText(e.target.value);
                    handleTyping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      formRef.current?.requestSubmit();
                    }
                  }}
                  disabled={!canMessage}
                  placeholder={
                    canMessage
                      ? "Type a message..."
                      : messagingError || "Can't send messages"
                  }
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={!messageText.trim() || !canMessage}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600"
                >
                  <Send size={20} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageCircle size={48} className="text-gray-300 mx-auto mb-4" />
              <p>Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
