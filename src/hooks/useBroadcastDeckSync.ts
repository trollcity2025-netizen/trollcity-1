import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDeckPair, DECK_PAIR_STORAGE_KEY, sendToDeckPair } from './useDeckPair';
import type { DeckPairMessage } from './useDeckPair';

interface UseBroadcastDeckSyncOptions {
  streamId: string | undefined;
  isHost: boolean;
  stream: {
    current_viewers?: number;
    total_gifts_coins?: number;
    total_likes?: number;
    is_live?: boolean;
    id?: string;
  } | null;
  roomRef: React.MutableRefObject<any>;
  onStreamEnd?: () => void;
}

export function useBroadcastDeckSync({
  streamId,
  isHost,
  stream,
  roomRef,
  onStreamEnd,
}: UseBroadcastDeckSyncOptions) {
  const pairCode = useRef<string | null>(localStorage.getItem(DECK_PAIR_STORAGE_KEY));
  const streamStartTime = useRef<number>(Date.now());
  const lastChatTxnIds = useRef<Set<string>>(new Set());
  const chatCount = useRef(0);
  const giftCount = useRef(0);
  const coinTotal = useRef(0);

  const handleDeckCommand = useCallback(async (msg: DeckPairMessage) => {
    switch (msg.type) {
      case 'deck-start-broadcast': {
        // Phone should trigger broadcast start - handled by SetupPage listener
        break;
      }
      case 'deck-end-broadcast': {
        if (isHost && onStreamEnd) {
          onStreamEnd();
        }
        break;
      }
      case 'deck-command': {
        if (!isHost) return;
        const { command, payload } = msg as any;
        switch (command) {
          case 'mute-mic': {
            const room = roomRef.current;
            if (room?.localParticipant) {
              await room.localParticipant.setMicrophoneEnabled(false);
            }
            break;
          }
          case 'unmute-mic': {
            const room = roomRef.current;
            if (room?.localParticipant) {
              await room.localParticipant.setMicrophoneEnabled(true);
            }
            break;
          }
          case 'mute-camera': {
            const room = roomRef.current;
            if (room?.localParticipant) {
              for (const pub of room.localParticipant.videoTrackPublications.values()) {
                if (pub.track) pub.track.setEnabled(false);
              }
            }
            break;
          }
          case 'unmute-camera': {
            const room = roomRef.current;
            if (room?.localParticipant) {
              for (const pub of room.localParticipant.videoTrackPublications.values()) {
                if (pub.track) pub.track.setEnabled(true);
              }
            }
            break;
          }
          case 'end-stream': {
            if (streamId && onStreamEnd) {
              onStreamEnd();
            }
            break;
          }
          case 'toggle-seats-lock': {
            if (streamId) {
              const currentLocked = (stream as any)?.are_seats_locked ?? false;
              await supabase
                .from('streams')
                .update({ are_seats_locked: !currentLocked })
                .eq('id', streamId);
            }
            break;
          }
          case 'send-chat': {
            if (streamId && payload?.message) {
              // Send chat message via the send-message edge function
              const { error } = await supabase.functions.invoke('send-message', {
                body: {
                  stream_id: streamId,
                  content: payload.message,
                  type: 'chat',
                },
              });
              if (error) {
                console.error('[DeckSync] Failed to send chat message:', error);
              }
            }
            break;
          }
        }
        break;
      }
    }
  }, [isHost, streamId, stream, roomRef, onStreamEnd]);

  const { isConnected: isPairConnected } = useDeckPair({
    pairCode: pairCode.current,
    onMessage: handleDeckCommand,
  });

  // Forward chat messages to deck
  useEffect(() => {
    if (!streamId || !isPairConnected) return;

    const channel = supabase
      .channel(`deck-sync-chat:${streamId}`)
      .on('broadcast', { event: 'chat' }, (payload: any) => {
        const msg = payload.payload;
        if (!msg) return;

        // Deduplicate
        const key = msg.txn_id || msg.id || `${msg.user_id}-${msg.content}-${msg.timestamp}`;
        if (lastChatTxnIds.current.has(key)) return;
        lastChatTxnIds.current.add(key);
        if (lastChatTxnIds.current.size > 500) {
          const arr = Array.from(lastChatTxnIds.current);
          lastChatTxnIds.current = new Set(arr.slice(-200));
        }

        if (msg.type === 'gift' || msg.content?.startsWith('GIFT_EVENT:')) {
          giftCount.current++;
        } else {
          chatCount.current++;
        }

        sendToDeckPair(pairCode.current!, {
          type: 'phone-chat-message',
          payload: {
            id: msg.id || key,
            userId: msg.user_id || 'unknown',
            username: msg.username || 'User',
            message: msg.content || '',
            timestamp: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
            isModerator: false,
            isSystem: msg.type === 'system' || msg.type === 'gift',
          },
        }).catch(() => {});
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, isPairConnected]);

  // Forward gift events to deck as alerts
  useEffect(() => {
    if (!streamId || !isPairConnected) return;

    const channel = supabase
      .channel(`deck-sync-gifts:${streamId}`)
      .on('broadcast', { event: 'gift_sent' }, (payload: any) => {
        const gift = payload.payload || payload;
        giftCount.current++;
        coinTotal.current += gift.gift_value || gift.coins || 0;

        sendToDeckPair(pairCode.current!, {
          type: 'phone-alert',
          payload: {
            id: `gift-${Date.now()}`,
            type: 'gift',
            message: `${gift.sender_username || 'Someone'} sent ${gift.gift_name || 'a gift'}!`,
            timestamp: Date.now(),
            read: false,
            data: gift,
          },
        }).catch(() => {});
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, isPairConnected]);

  // Send stream stats to deck periodically
  useEffect(() => {
    if (!streamId || !isPairConnected) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - streamStartTime.current) / 1000);

      sendToDeckPair(pairCode.current!, {
        type: 'phone-stream-stats',
        payload: {
          viewerCount: stream?.current_viewers || 0,
          peakViewers: stream?.current_viewers || 0,
          duration: elapsed,
          chatMessages: chatCount.current,
          giftsReceived: giftCount.current,
          coinsEarned: stream?.total_gifts_coins || coinTotal.current,
          streamHealth: 'good',
          bitrate: 0,
          fps: 0,
          droppedFrames: 0,
        },
      }).catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, [streamId, isPairConnected, stream?.current_viewers, stream?.total_gifts_coins]);

  // Send stream-started confirmation when pair connects
  useEffect(() => {
    if (isPairConnected && streamId && stream?.is_live) {
      sendToDeckPair(pairCode.current!, {
        type: 'phone-stream-started',
        payload: { streamId },
      }).catch(() => {});
    }
  }, [isPairConnected, streamId, stream?.is_live]);
}
