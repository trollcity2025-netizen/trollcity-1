import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { useDeckStore } from '../../stores/deckStore';
import { useDeckPWA } from '../../pwa/useDeckPWA';
import { Radio, Mail, Lock, AlertCircle, Info, Loader2 } from 'lucide-react';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export default function DeckAuth() {
  const navigate = useNavigate();
  const { setAuth, setProfile } = useAuthStore();
  const { setSession } = useDeckStore();
  useDeckPWA();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!data.user || !data.session) {
        setError('Sign in failed. Please try again.');
        setLoading(false);
        return;
      }

      // Fetch profile
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      // Set auth in main store
      setAuth(data.user, data.session);
      if (profileData) setProfile(profileData);

      // Check for quality upgrade
      if (profileData?.deck_quality_upgrade) {
        useDeckStore.getState().setHasQualityUpgrade(true);
      }

      // Create Deck session with 24hr expiry
      const now = Date.now();
      setSession({
        userId: data.user.id,
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
        .eq('id', data.user.id);

      navigate('/deck', { replace: true });
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="deck-app">
      <div className="deck-auth">
        <div className="deck-auth-card">
          <Radio size={40} color="#6a00ff" />
          <h1>Troll City Deck</h1>
          <p className="deck-auth-subtitle">
            Broadcast control companion. Sign in with your Troll City account.
          </p>

          <div className="deck-auth-info">
            <Info size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            Sessions expire every 24 hours for security. You&apos;ll need to sign in again after expiry.
          </div>

          {error && (
            <div className="deck-auth-error">
              <AlertCircle size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              {error}
            </div>
          )}

          <form className="deck-auth-form" onSubmit={handleSignIn}>
            <div>
              <label className="deck-label" htmlFor="deck-email">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: 12, top: 11, color: '#6b6585' }} />
                <input
                  id="deck-email"
                  className="deck-input"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  style={{ paddingLeft: 36 }}
                />
              </div>
            </div>
            <div>
              <label className="deck-label" htmlFor="deck-password">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 12, top: 11, color: '#6b6585' }} />
                <input
                  id="deck-password"
                  className="deck-input"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{ paddingLeft: 36 }}
                />
              </div>
            </div>
            <button
              type="submit"
              className="deck-btn deck-btn-primary deck-btn-lg deck-btn-block"
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Signing In...' : 'Sign In to Deck'}
            </button>
          </form>

          <p style={{ fontSize: 11, color: '#6b6585', marginTop: 20 }}>
            Troll Deck is a broadcast-only companion app.
            It does not provide access to other Troll City features.
          </p>
        </div>
      </div>
    </div>
  );
}
