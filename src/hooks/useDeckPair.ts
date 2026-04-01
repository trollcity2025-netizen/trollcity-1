import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';

export type DeckPairMessage =
  | { type: 'deck-joined'; userId: string; timestamp: number }
  | { type: 'phone-sync'; payload: Record<string, unknown>; timestamp: number }
  | { type: 'phone-ready'; payload: Record<string, unknown>; timestamp: number }
  | { type: 'phone-stream-stats'; payload: Record<string, unknown>; timestamp: number }
  | { type: 'phone-chat-message'; payload: Record<string, unknown>; timestamp: number }
  | { type: 'phone-alert'; payload: Record<string, unknown>; timestamp: number }
  | { type: 'phone-stream-started'; payload: Record<string, unknown>; timestamp: number }
  | { type: 'phone-stream-ended'; timestamp: number }
  | { type: 'phone-disconnected'; timestamp: number }
  | { type: 'deck-start-broadcast'; payload?: Record<string, unknown>; timestamp: number }
  | { type: 'deck-end-broadcast'; timestamp: number }
  | { type: 'deck-command'; command: string; payload?: Record<string, unknown>; timestamp: number };

interface UseDeckPairOptions {
  pairCode: string | null;
  onMessage?: (msg: DeckPairMessage) => void;
}

const activeChannels = new Map<string, ReturnType<typeof supabase.channel>>();
const channelReady = new Map<string, boolean>();

export function getDeckPairChannel(pairCode: string): ReturnType<typeof supabase.channel> | null {
  return activeChannels.get(pairCode) || null;
}

export async function sendToDeckPair(pairCode: string, msg: Omit<DeckPairMessage, 'timestamp'>) {
  if (!pairCode) return;
  
  let channel = activeChannels.get(pairCode);
  
  // If no channel exists, create one temporarily
  if (!channel) {
    const channelName = `deck-pair:${pairCode}`;
    channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });
    activeChannels.set(pairCode, channel);
  }

  // Wait for channel to be ready (max 5 seconds)
  const isReady = channelReady.get(pairCode);
  if (!isReady) {
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (channelReady.get(pairCode)) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      // Timeout after 5s - try sending anyway
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });
  }

  try {
    await channel.send({
      type: 'broadcast',
      event: 'deck-msg',
      payload: { ...msg, timestamp: Date.now() },
    });
  } catch (e) {
    console.error('[DeckPair] Failed to send message:', e);
  }
}

export function useDeckPair({ pairCode, onMessage }: UseDeckPairOptions) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!pairCode) {
      setIsConnected(false);
      return;
    }

    const channelName = `deck-pair:${pairCode}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'deck-msg' }, (event) => {
      const msg = event.payload as DeckPairMessage;
      onMessageRef.current?.(msg);
    });

    channel.subscribe((status) => {
      const ready = status === 'SUBSCRIBED';
      setIsConnected(ready);
      channelReady.set(pairCode, ready);
    });

    channelRef.current = channel;
    activeChannels.set(pairCode, channel);

    return () => {
      activeChannels.delete(pairCode);
      channelReady.delete(pairCode);
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [pairCode]);

  const send = useCallback(async (msg: Omit<DeckPairMessage, 'timestamp'>) => {
    if (!channelRef.current || !isConnected) return;
    try {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'deck-msg',
        payload: { ...msg, timestamp: Date.now() },
      });
    } catch (e) {
      console.error('[DeckPair] send failed:', e);
    }
  }, [isConnected]);

  return { send, isConnected };
}

export function generatePairCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export const DECK_PAIR_STORAGE_KEY = 'tc_deck_pair_code';
