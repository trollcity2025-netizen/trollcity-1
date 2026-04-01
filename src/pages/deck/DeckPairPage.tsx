import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { useDeckStore } from '../../stores/deckStore';
import { useDeckPWA } from '../../pwa/useDeckPWA';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const PAIR_CHANNEL_PREFIX = 'tc-deck-pair-';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export default function DeckPairPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth, setProfile } = useAuthStore();
  const { setSession: setDeckSession } = useDeckStore();
  useDeckPWA();

  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const handlePair = async () => {
      if (!token) {
        setErrorMsg('No pairing token provided.');
        setStatus('error');
        return;
      }

      try {
        // Get current Supabase session (works regardless of auth store hydration)
        const { data: { session: sbSession } } = await supabase.auth.getSession();
        let userId: string | null = null;
        let userEmail: string | null = null;

        if (sbSession?.user) {
          // User has an active Supabase session on this device
          userId = sbSession.user.id;
          userEmail = sbSession.user.email || null;
        }

        // If no session, try to resolve user from the token itself
        if (!userId) {
          const { data: tokenRow } = await supabase
            .from('deck_pair_tokens')
            .select('user_id, expires_at, used')
            .eq('token', token)
            .maybeSingle();

          if (tokenRow) {
            if (tokenRow.used) {
              setErrorMsg('This pairing code has already been used.');
              setStatus('error');
              return;
            }
            if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
              setErrorMsg('This pairing code has expired. Please generate a new one from Deck.');
              setStatus('error');
              return;
            }
            userId = tokenRow.user_id;
          }
        }

        if (!userId) {
          setErrorMsg('Could not identify your account. Please log in first.');
          setStatus('error');
          return;
        }

        // Mark token as used
        await supabase
          .from('deck_pair_tokens')
          .update({ used: true })
          .eq('token', token)
          .catch(() => {});

        // Fetch user profile
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single();

        // If we got a supabase session, sync the auth store
        if (sbSession?.user) {
          setAuth(sbSession.user, sbSession);
        }
        if (profileData) {
          setProfile(profileData);
        }

        // Create Deck session with 24hr expiry
        const now = Date.now();
        setDeckSession({
          userId,
          startedAt: now,
          expiresAt: now + SESSION_DURATION_MS,
          isValid: true,
        });

        // Store session expiry server-side
        await supabase
          .from('user_profiles')
          .update({
            deck_session_started: new Date(now).toISOString(),
            deck_session_expires: new Date(now + SESSION_DURATION_MS).toISOString(),
          })
          .eq('id', userId)
          .catch(() => {});

        // Notify the desktop via BroadcastChannel that phone is paired
        const channel = new BroadcastChannel(PAIR_CHANNEL_PREFIX + token);
        channel.postMessage({
          type: 'phone-paired',
          payload: {
            userId,
            email: userEmail || profileData?.email || '',
            timestamp: now,
          },
        });
        // Keep channel open briefly for the desktop to receive the message
        setTimeout(() => channel.close(), 2000);

        // Clear saved token
        localStorage.removeItem('tc_deck_pair_token');

        setStatus('success');

        // Navigate to deck after brief success display
        setTimeout(() => {
          navigate('/deck', { replace: true });
        }, 1500);
      } catch (err: any) {
        console.error('[DeckPair] Pairing error:', err);
        setErrorMsg(err.message || 'Failed to complete pairing.');
        setStatus('error');
      }
    };

    handlePair();
  }, [token, navigate, setAuth, setProfile, setDeckSession]);

  if (status === 'loading') {
    return (
      <div className="deck-app">
        <div className="deck-auth">
          <div className="deck-auth-card">
            <Loader2 size={40} color="#6a00ff" className="animate-spin" />
            <h1>Connecting...</h1>
            <p className="deck-auth-subtitle">
              Linking your phone to Troll City Deck.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="deck-app">
        <div className="deck-auth">
          <div className="deck-auth-card">
            <CheckCircle size={40} color="var(--deck-success)" />
            <h1>Phone Connected!</h1>
            <p className="deck-auth-subtitle">
              Your phone is now linked to your Deck account. Redirecting...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="deck-app">
      <div className="deck-auth">
        <div className="deck-auth-card">
          <AlertCircle size={40} color="#ef4444" />
          <h1>Pairing Failed</h1>
          <p className="deck-auth-subtitle">{errorMsg}</p>
          <button
            className="deck-btn deck-btn-primary deck-btn-lg deck-btn-block"
            onClick={() => navigate('/deck/auth', { replace: true })}
            style={{ marginTop: 16 }}
          >
            Go to Deck Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
