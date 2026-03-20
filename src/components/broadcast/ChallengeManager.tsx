import React from 'react';
import { Swords, X, Check, Crown, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { useAuthStore } from '../../lib/store';

interface Challenge {
  challenge_id: string;
  challenger_id: string;
  challenger_username: string;
  challenger_avatar?: string;
  challenger_crowns: number;
  stream_id: string;
  expires_at: string;
}

interface ChallengeManagerProps {
  challenges: Challenge[];
  onAccept: (challengeId: string, challengerId: string) => void;
  onDeny: (challengeId: string) => void;
}

export default function ChallengeManager({
  challenges,
  onAccept,
  onDeny
}: ChallengeManagerProps) {
  const { user } = useAuthStore();
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  const handleAccept = async (challenge: Challenge) => {
    if (!user) return;
    
    setProcessingId(challenge.challenge_id);

    try {
      // Get broadcaster's stream - check both status: 'live' and is_live: true for compatibility
      const { data: broadcasterStream, error: broadcasterStreamError } = await supabase
        .from('streams')
        .select('id, seat_price, seat_prices')
        .eq('user_id', user.id)
        .eq('is_live', true)
        .maybeSingle();

      if (broadcasterStreamError || !broadcasterStream) {
        console.error('Error getting broadcaster stream:', broadcasterStreamError);
        toast.error('Could not find your live stream');
        setProcessingId(null);
        return;
      }

      // Find an available seat index
      const { data: existingSeats } = await supabase
        .from('stream_seat_sessions')
        .select('seat_index')
        .eq('stream_id', broadcasterStream.id)
        .eq('status', 'active')
        .order('seat_index', { ascending: true });

      let availableSeatIndex = 0;
      if (existingSeats && existingSeats.length > 0) {
        const usedIndices = new Set(existingSeats.map(s => s.seat_index));
        while (usedIndices.has(availableSeatIndex)) {
          availableSeatIndex++;
        }
      }

      // Add challenger to the stream as a stage guest (free seat)
      // This will allow them to join as a publisher to the same LiveKit room
      // First check if they already have a seat
      const { data: existingSeat } = await supabase
        .from('stream_seat_sessions')
        .select('id, seat_index')
        .eq('stream_id', broadcasterStream.id)
        .eq('user_id', challenge.challenger_id)
        .eq('status', 'active')
        .maybeSingle();

      if (existingSeat) {
        // Challenger already has a seat, use that index
        availableSeatIndex = existingSeat.seat_index;
        
        // Update the seat to mark as challenger if not already set
        await supabase
          .from('stream_seat_sessions')
          .update({
            is_challenger: true
          })
          .eq('id', existingSeat.id)
          .is('is_challenger', false);
      } else {
        // Insert new seat for challenger - profile data will be fetched via JOIN in get_stream_seats
        const { data: seatData, error: seatError } = await supabase
          .from('stream_seat_sessions')
          .insert({
            stream_id: broadcasterStream.id,
            user_id: challenge.challenger_id,
            seat_index: availableSeatIndex,
            status: 'active',
            is_challenger: true, // Mark as challenger
            joined_at: new Date().toISOString()
          })
          .select()
          .maybeSingle();

        if (seatError) {
          console.error('Error adding challenger to stream:', seatError);
          // Continue anyway - the challenge acceptance is more important
        }
      }

      // CRITICAL: Transform broadcast into 5v5 battle mode
      // Create a battle record for BattleView - single stream becomes battle arena
      // Use same stream for both challenger and opponent (same broadcast transforms)
      const { data: battleData, error: battleCreateError } = await supabase
        .from('battles')
        .insert({
          challenger_stream_id: broadcasterStream.id,
          opponent_stream_id: broadcasterStream.id, // Same stream - transforms into battle
          status: 'active',
          started_at: new Date().toISOString()
        })
        .select()
        .maybeSingle();

      if (battleCreateError) {
        console.error('Error creating battle:', battleCreateError);
      } else if (battleData) {
        console.log('[ChallengeManager] Battle created:', battleData.id);
        
        // Add broadcaster as challenger team (host)
        await supabase
          .from('battle_participants')
          .insert({
            battle_id: battleData.id,
            user_id: user.id,
            role: 'host',
            team: 'challenger',
            metadata: JSON.stringify({ seatIndex: 0, sourceStreamId: broadcasterStream.id })
          });

        // Add challenger as opponent team (stage guest)
        await supabase
          .from('battle_participants')
          .insert({
            battle_id: battleData.id,
            user_id: challenge.challenger_id,
            role: 'stage',
            team: 'opponent',
            metadata: JSON.stringify({ seatIndex: availableSeatIndex, sourceStreamId: broadcasterStream.id })
          });

        // Enable battle mode on stream
        await supabase
          .from('streams')
          .update({ is_battle: true, battle_id: battleData.id })
          .eq('id', broadcasterStream.id);

        // Update challenge status to accepted
        await supabase
          .from('broadcast_challenges')
          .update({ 
            status: 'accepted',
            accepted_at: new Date().toISOString(),
            seat_index: availableSeatIndex,
            battle_id: battleData.id
          })
          .eq('id', challenge.challenge_id);
      }

      // Notify challenger via realtime that challenge was accepted
      // Include seat index so challenger knows where to join
      // Use the same channel format as BroadcastPage expects: challenge-viewer-{streamId}
      const challengeChannel = supabase.channel(`challenge-viewer-${challenge.stream_id}`);
      await challengeChannel.send({
        type: 'broadcast',
        event: 'challenge_accepted',
        payload: {
          challenge_id: challenge.challenge_id,
          challenger_id: challenge.challenger_id,
          challenger_username: challenge.challenger_username,
          broadcaster_id: user.id,
          stream_id: challenge.stream_id,
          seat_index: availableSeatIndex,
          timestamp: new Date().toISOString()
        }
      });

      // Call parent handler
      onAccept(challenge.challenge_id, challenge.challenger_id);
      toast.success('Challenge accepted! Challenger has been invited to the stage.');
    } catch (err) {
      console.error('Error accepting challenge:', err);
      toast.error('Failed to accept challenge');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeny = async (challenge: Challenge) => {
    if (!user) return;
    
    setProcessingId(challenge.challenge_id);

    try {
      // Update challenge status in database
      const { error: updateError } = await supabase
        .from('broadcast_challenges')
        .update({
          status: 'denied',
          denied_at: new Date().toISOString()
        })
        .eq('id', challenge.challenge_id);

      if (updateError) {
        console.error('Error denying challenge:', updateError);
        toast.error('Failed to deny challenge');
        return;
      }

      // Notify challenger via realtime
      // Use the same channel format as BroadcastPage expects: challenge-viewer-{streamId}
      const challengeChannel = supabase.channel(`challenge-viewer-${challenge.stream_id}`);
      await challengeChannel.send({
        type: 'broadcast',
        event: 'challenge_denied',
        payload: {
          challenge_id: challenge.challenge_id,
          challenger_id: challenge.challenger_id,
          broadcaster_id: user.id,
          stream_id: challenge.stream_id,
          timestamp: new Date().toISOString()
        }
      });

      // Call parent handler
      onDeny(challenge.challenge_id);
      toast.info('Challenge denied');
    } catch (err) {
      console.error('Error denying challenge:', err);
      toast.error('Failed to deny challenge');
    } finally {
      setProcessingId(null);
    }
  };

  // Calculate time remaining
  const getTimeRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gradient-to-r from-purple-900/30 to-red-900/30 rounded-xl p-4 border border-purple-500/30">
      <div className="flex items-center gap-2 mb-4">
        <Swords size={20} className="text-purple-400" />
        <h3 className="text-white font-bold">Incoming Challenges</h3>
        <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded-full">
          {challenges.length}
        </span>
      </div>

      <div className="space-y-3">
        {challenges.map((challenge) => (
          <div
            key={challenge.challenge_id}
            className="bg-black/40 rounded-lg p-3 border border-white/5 flex items-center justify-between"
          >
            {/* Challenger Info */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-red-500 flex items-center justify-center text-white font-bold overflow-hidden">
                {challenge.challenger_avatar ? (
                  <img 
                    src={challenge.challenger_avatar} 
                    alt={challenge.challenger_username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  challenge.challenger_username?.charAt(0).toUpperCase() || '?'
                )}
              </div>
              <div>
                <p className="text-white font-medium text-sm">
                  {challenge.challenger_username || 'Unknown'}
                </p>
                <div className="flex items-center gap-1 text-amber-400">
                  <Crown size={12} />
                  <span className="text-xs">{challenge.challenger_crowns || 0} Crowns</span>
                </div>
              </div>
            </div>

            {/* Time Remaining */}
            <div className="flex items-center gap-2 text-zinc-400">
              <Clock size={14} />
              <span className="text-xs">{getTimeRemaining(challenge.expires_at)}</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDeny(challenge)}
                disabled={processingId === challenge.challenge_id}
                className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors disabled:opacity-50"
                title="Deny Challenge"
              >
                <X size={16} />
              </button>
              <button
                onClick={() => handleAccept(challenge)}
                disabled={processingId === challenge.challenge_id}
                className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {processingId === challenge.challenge_id ? (
                  <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                <span className="text-xs font-medium">Accept</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 mt-3 bg-yellow-500/10 rounded-lg p-2 border border-yellow-500/20">
        <AlertTriangle size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-yellow-200/70">
          Accepting a challenge will transform your broadcast into a 5v5 battle arena. Both teams will compete for 2 crowns per person!
        </p>
      </div>
    </div>
  );
}
