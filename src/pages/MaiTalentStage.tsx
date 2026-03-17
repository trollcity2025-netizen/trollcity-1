import React, { useState, useEffect } from 'react';
import { useLiveKitRoom } from '@/hooks/useLiveKitRoom';
import { useJudgeRole } from '@/hooks/useJudgeRole';
import GoldenBuzzerEffect from '@/components/maitalent/GoldenBuzzerEffect';
import { StageCurtains } from '@/components/maitalent/StageCurtains';
import MaiTalentNav from '@/components/maitalent/MaiTalentNav';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import MaiTalentLayout from '@/components/maitalent/MaiTalentLayout';
import GiftAnnouncements from '@/components/maitalent/GiftAnnouncements';
import { Button } from '@/components/ui/button';
import GiftButton from '@/components/maitalent/GiftButton';
import { useGoldenBuzzer } from '@/lib/useGoldenBuzzer';
import { StageEnvironment } from '@/components/maitalent/StageEnvironment';
import { StageLighting } from '@/components/maitalent/StageLighting';
import PerformerFrame from '@/components/maitalent/PerformerFrame';
import JudgeRow from '@/components/maitalent/JudgeRow';
import LiveStatusBar from '@/components/maitalent/LiveStatusBar';
import QueueSidePanel from '@/components/maitalent/QueueSidePanel';
import AudienceForeground from '@/components/maitalent/AudienceForeground';

const PerformerInfo = ({ performer }) => {
  const [coins, setCoins] = useState(performer?.total_votes || 0);

  useEffect(() => {
    if (performer) {
      const subscription = supabase
        .channel(`mai_talent_votes:${performer.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mai_talent_votes', filter: `audition_id=eq.${performer.id}` }, (payload) => {
          setCoins((prevCoins) => prevCoins + payload.new.amount);
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [performer]);

  return (
    <div className="flex items-center gap-3">
      <img src={performer?.user_profiles?.avatar_url || 'https://ui-avatars.com/api/?background=random'} className="w-12 h-12 rounded-full" />
      <div>
        <p className="font-bold text-white">{performer?.user_profiles?.username || 'Performer'}</p>
        <p className="text-sm text-yellow-400">{coins.toLocaleString()} Coins</p>
      </div>
    </div>
  );
};

const VoteControls = ({ isJudge, performer, showId }) => {
  const { profile } = useAuthStore();
  

  const handleBuzzerClick = async () => {
    if (window.confirm('Are you sure you want to use the Golden Buzzer?')) {
      await supabase.from('mai_talent_judge_votes').insert({
        session_id: showId,
        judge_id: profile.id,
        contestant_id: performer.id,
        golden_buzzer: true,
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isJudge && (
        <>
          <Button size="sm" className="bg-green-500 hover:bg-green-600">Yes</Button>
          <Button size="sm" className="bg-red-500 hover:bg-red-600">No</Button>
          <Button size="sm" onClick={handleBuzzerClick} className="bg-yellow-500 hover:bg-yellow-600 text-black">Buzzer</Button>
        </>
      )}
      {!isJudge && (
        <GiftButton performer={performer} showId={showId} />
      )}
    </div>
  );
};

const PerformerStage = ({ performer, slot, isJudge, showId, localVideoTrack, localAudioTrack, remoteUser, canPublish, livekitClient }) => {
  return (
    <div className="flex flex-col gap-3">
      <PerformerFrame 
        performer={performer}
        slot={slot}
        localVideoTrack={localVideoTrack}
        localAudioTrack={localAudioTrack}
        remoteUser={remoteUser}
        canPublish={canPublish}
        livekitClient={livekitClient}
      />
      <div className="flex items-center justify-between mt-3">
        <PerformerInfo performer={performer} />
        <VoteControls isJudge={isJudge} performer={performer} showId={showId} />
      </div>
    </div>
  )
}

const MaiTalentStage = () => {
  const { active: isExploding } = useGoldenBuzzer();
  const { isJudge } = useJudgeRole();
  const [isQueueOpen, setIsQueueOpen] = useState(true);
  const [curtainsOpen, setCurtainsOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [stageSlots, setStageSlots] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [judgeSeats, setJudgeSeats] = useState<any[]>([]);
  const [isOnStage, setIsOnStage] = useState(false);
  const [isInQueue, setIsInQueue] = useState(false);
  const { profile } = useAuthStore();

  const { localVideoTrack, localAudioTrack, remoteUsers, client } = useLiveKitRoom({
    roomId: session?.id || 'maitalent-stage', // Use session ID for room
    role: 'publisher',
    publish: false, // Control publishing manually
  });

  useEffect(() => {
    const initializeSession = async () => {
      if (!profile) return;

      const { data: latestSession } = await supabase
        .from('mai_show_sessions')
        .select('id')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let sessionId = latestSession?.id;

      if (!sessionId) {
        const { data: newSession, error } = await supabase
          .from('mai_show_sessions')
          .insert({ title: 'New Mai Talent Show', status: 'active', host_id: profile.id })
          .select('id')
          .single();
        
        if (error) {
          console.error('Error creating new session:', error);
          return;
        }
        sessionId = newSession.id;
      }

      const { data: sessionData } = await supabase.from('mai_show_sessions').select('*').eq('id', sessionId).single();
      setSession(sessionData);
    };

    initializeSession();
  }, [profile]);

  useEffect(() => {
    if (!session?.id) return;

    const fetchAllData = async () => {
      const { data: slotsData } = await supabase.from('mai_stage_slots').select('*, user_profiles(*)').eq('session_id', session.id);
      const { data: queueData } = await supabase.from('mai_queue').select('*, user_profiles(*)').eq('session_id', session.id).order('position');
      const { data: judgeData } = await supabase.from('mai_judge_seats').select('*, user_profiles(*)').eq('session_id', session.id).order('seat_number');
      setStageSlots(slotsData || []);
      setQueue(queueData || []);
      setJudgeSeats(judgeData || []);
      
      // Compute isOnStage and isInQueue based on profile
      const onStage = (slotsData || []).some(slot => slot.user_id === profile?.id);
      const inQueue = (queueData || []).some(q => q.user_id === profile?.id);
      setIsOnStage(onStage);
      setIsInQueue(inQueue);
    };

    fetchAllData();

    const sessionChannel = supabase.channel(`mai-session-${session.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mai_show_sessions', filter: `id=eq.${session.id}` }, (payload) => {
        setSession(payload.new);
      })
      .subscribe();

    const slotsChannel = supabase.channel(`mai-slots-${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mai_stage_slots', filter: `session_id=eq.${session.id}` }, fetchAllData)
      .subscribe();

    const queueChannel = supabase.channel(`mai-queue-${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mai_queue', filter: `session_id=eq.${session.id}` }, fetchAllData)
      .subscribe();

    const judgeChannel = supabase.channel(`mai-judges-${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mai_judge_seats', filter: `session_id=eq.${session.id}` }, fetchAllData)
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(slotsChannel);
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(judgeChannel);
    };
  }, [session?.id, profile?.id]);

  const performerA = stageSlots.find(s => s.slot === 'A');
  const performerB = stageSlots.find(s => s.slot === 'B');

  const remotePerformerA = remoteUsers.find(u => u.uid === performerA?.user_id);
  const remotePerformerB = remoteUsers.find(u => u.uid === performerB?.user_id);

  const performerAData = performerA ? { ...remotePerformerA, ...performerA } : null;
  const performerBData = performerB ? { ...remotePerformerB, ...performerB } : null;

  const handleJoinQueue = async () => {
    if (!profile || !session?.id) return;
    await supabase.functions.invoke('mai-talent-v2-orchestrator', {
      body: { command: 'join-queue', payload: { sessionId: session.id, userId: profile.id } }
    });
  };

  const handleLeaveQueue = async () => {
    if (!profile || !session?.id) return;
    await supabase.functions.invoke('mai-talent-v2-orchestrator', {
      body: { command: 'leave-queue', payload: { sessionId: session.id, userId: profile.id } }
    });
  };

  const handleLeaveStage = async () => {
    if (!profile || !session?.id) return;
    await supabase.functions.invoke('mai-talent-v2-orchestrator', {
      body: { command: 'leave-stage', payload: { sessionId: session.id, userId: profile.id } }
    });
  };

  const handleJoinJudgeSeat = async (seatNumber: number) => {
    if (!profile || !session?.id) return;
    await supabase.from('mai_judge_seats').update({ user_id: profile.id }).eq('session_id', session.id).eq('seat_number', seatNumber);
  };

  const handleLeaveJudgeSeat = async (seatNumber: number) => {
    if (!profile || !session?.id) return;
    await supabase.from('mai_judge_seats').update({ user_id: null }).eq('session_id', session.id).eq('seat_number', seatNumber);
  };

  const handleOpenCurtains = () => {
    setCurtainsOpen(true);
  };

  // Determine if current user is on stage
  const isUserPerformer = stageSlots.some(slot => slot.user_id === profile?.id);
  const canPublishPerformer = isUserPerformer;
  
  // Determine if current user is a judge
  const isUserJudge = judgeSeats.some(seat => seat.user_id === profile?.id);
  const canPublishJudge = isUserJudge && isJudge;

  return (
    <MaiTalentLayout>
      {/* CINEMATIC STAGE ENVIRONMENT */}
      <StageEnvironment>
        {/* STAGE LIGHTING */}
        <StageLighting isActive={curtainsOpen} />
        
        {/* AUDIENCE FOREGROUND */}
        <AudienceForeground>
          <div className="container mx-auto px-4 py-6 h-full flex flex-col">
            {/* TOP NAVIGATION */}
            <MaiTalentNav />
            
            {/* LIVE STATUS BAR */}
            <div className="flex justify-center mb-6">
              <LiveStatusBar
                viewerCount={remoteUsers.length + 1}
                round={session?.round || 1}
                timer={session?.timer || 0}
                showTitle={session?.title || 'Mai Talent Show'}
                isLive={curtainsOpen}
              />
            </div>

            {/* MAIN STAGE - PERFORMERS */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Performer A */}
              <PerformerStage 
                performer={performerAData} 
                slot="A" 
                isJudge={isJudge} 
                showId={session?.id}
                localVideoTrack={canPublishPerformer ? localVideoTrack : undefined}
                localAudioTrack={canPublishPerformer ? localAudioTrack : undefined}
                remoteUser={remotePerformerA}
                canPublish={canPublishPerformer}
                livekitClient={client}
              />
              
              {/* Performer B */}
              <PerformerStage 
                performer={performerBData} 
                slot="B" 
                isJudge={isJudge} 
                showId={session?.id}
                localVideoTrack={canPublishPerformer ? localVideoTrack : undefined}
                localAudioTrack={canPublishPerformer ? localAudioTrack : undefined}
                remoteUser={remotePerformerB}
                canPublish={canPublishPerformer}
                livekitClient={client}
              />
            </div>

            {/* JUDGE ROW */}
            <div className="mb-8">
              <JudgeRow
                seats={judgeSeats}
                currentUserId={profile?.id}
                localVideoTrack={canPublishJudge ? localVideoTrack : undefined}
                localAudioTrack={canPublishJudge ? localAudioTrack : undefined}
                canPublish={canPublishJudge}
                livekitClient={client}
                onJoinSeat={handleJoinJudgeSeat}
                onLeaveSeat={handleLeaveJudgeSeat}
              />
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex justify-center items-center gap-4">
              {!isOnStage && !isInQueue && (
                <Button 
                  onClick={handleJoinQueue}
                  className="bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white font-bold px-8 py-3 rounded-full shadow-lg shadow-yellow-600/30"
                >
                  Join Audition Queue
                </Button>
              )}
              {isInQueue && (
                <Button 
                  onClick={handleLeaveQueue} 
                  variant="destructive"
                  className="px-8 py-3 rounded-full"
                >
                  Leave Queue
                </Button>
              )}
              {isOnStage && (
                <Button 
                  onClick={handleLeaveStage} 
                  variant="destructive"
                  className="px-8 py-3 rounded-full"
                >
                  Leave Stage
                </Button>
              )}
            </div>
          </div>
        </AudienceForeground>

        {/* QUEUE SIDE PANEL */}
        {isJudge && session?.id && (
          <QueueSidePanel
            queue={queue}
            currentUserId={profile?.id}
            isOpen={isQueueOpen}
            onClose={() => setIsQueueOpen(false)}
            onJoin={handleJoinQueue}
            onLeave={handleLeaveQueue}
            isUserInQueue={isInQueue}
          />
        )}

        {/* EFFECTS & OVERLAYS */}
        {!curtainsOpen && (
          <div className="absolute inset-0 z-[9991] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-yellow-400 mb-4">Mai Talent Show</h2>
              <Button 
                onClick={handleOpenCurtains}
                className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-2xl px-8 py-6 rounded-full shadow-lg shadow-yellow-500/30 transition-all hover:shadow-yellow-500/50 hover:scale-105"
              >
                Open Curtains
              </Button>
            </div>
          </div>
        )}
        
        <GoldenBuzzerEffect isExploding={isExploding} />
        <StageCurtains isOpen={curtainsOpen} />
        <GiftAnnouncements showId={session?.id} />
      </StageEnvironment>
    </MaiTalentLayout>
  );
};

export default MaiTalentStage;
