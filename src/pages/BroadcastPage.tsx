import React, { 
  useCallback, 
  useEffect, 
  useMemo, 
  useState 
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveKit } from '../hooks/useLiveKit';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import ChatBox from '../components/broadcast/ChatBox';
import GiftModal from '../components/broadcast/GiftModal';
import ProfileModal from '../components/broadcast/ProfileModal';
import CoinStoreModal from '../components/broadcast/CoinStoreModal';
import GiftEventOverlay from './GiftEventOverlay';
import { useGiftEvents } from '../lib/hooks/useGiftEvents';
import EntranceEffect from '../components/broadcast/EntranceEffect';
import BroadcastLayout from '../components/broadcast/BroadcastLayout';
import BroadcastOverlays from '../components/stream/BroadcastOverlays';

// Constants
const STREAM_POLL_INTERVAL = 2000;

interface StreamData {
  id: string;
  broadcaster_id: string;
  title: string;
  status: string;
  is_live: boolean;
  total_likes: number;
  current_viewers: number;
  total_gifts_coins: number;
}

export default function BroadcastPage() {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  
  // States
  const [stream, setStream] = useState<StreamData | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [giftRecipient, setGiftRecipient] = useState<any>(null);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [isCoinStoreOpen, setIsCoinStoreOpen] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  
  // LiveKit
  const liveKit = useLiveKit({
    url: import.meta.env.VITE_LIVEKIT_URL,
    token: '', // Token handled by hook via API
  });

  // Derived
  const isBroadcaster = user?.id === stream?.broadcaster_id;
  
  // Load stream
  useEffect(() => {
    if (!streamId) return;
    
    const loadStream = async () => {
      const { data, error } = await supabase
        .from('streams')
        .select('*')
        .eq('id', streamId)
        .single();
        
      if (error) {
        console.error('Error loading stream:', error);
        toast.error('Failed to load stream');
        return;
      }
      setStream(data);
    };
    
    loadStream();
    
    const interval = setInterval(async () => {
       const { data } = await supabase.from('streams').select('current_viewers, total_likes, total_gifts_coins, is_live').eq('id', streamId).single();
       if (data) setStream(prev => prev ? { ...prev, ...data } : prev);
    }, STREAM_POLL_INTERVAL);
    
    return () => clearInterval(interval);
  }, [streamId]);

  // Join/Init LiveKit
  useEffect(() => {
    if (!streamId || !user || !profile) return;
    
    const initSession = async () => {
      try {
        await liveKit.connect(streamId, user.id, isBroadcaster);
        if (isBroadcaster) {
           await liveKit.toggleMicrophone(micOn);
           await liveKit.toggleCamera(cameraOn);
        }
      } catch (err) {
        console.error('Failed to connect to LiveKit:', err);
        toast.error('Failed to start broadcast session');
      }
    };
    
    initSession();
    
    return () => {
      liveKit.disconnect();
    };
  }, [streamId, user, isBroadcaster]);

  // Handlers
  const toggleMic = async () => {
    const newState = !micOn;
    setMicOn(newState);
    await liveKit.toggleMicrophone(newState);
  };

  const toggleCamera = async () => {
    const newState = !cameraOn;
    setCameraOn(newState);
    await liveKit.toggleCamera(newState);
  };

  const endStream = async () => {
    if (!window.confirm('Are you sure you want to end the stream?')) return;
    
    try {
      await supabase.from('streams').update({ is_live: false, status: 'ended', end_time: new Date().toISOString() }).eq('id', streamId);
      navigate('/');
    } catch (err) {
      console.error('Failed to end stream:', err);
    }
  };

  // Gift Events
  const lastGift = useGiftEvents(streamId);
  const handleGiftSent = async (giftData: any) => {
    // Logic to record gift in Supabase handled by GiftModal or here
    // For now simple toast
    toast.success(`Sent ${giftData.quantity} ${giftData.name}!`);
    setIsGiftModalOpen(false);
  };

  // Entrance Effect (Mock for now, or use real data)
  const [entranceEffect, setEntranceEffect] = useState<any>(null);

  if (!stream) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading Broadcast...</div>;

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden flex flex-col md:flex-row">
      {entranceEffect && <EntranceEffect username={entranceEffect.username} role={entranceEffect.role} profile={entranceEffect.profile} />}
      
      {/* Main Video Area */}
      <div className="flex-1 relative h-full md:h-auto overflow-hidden">
        <BroadcastLayout
          room={liveKit.getRoom()}
          broadcasterId={stream.broadcaster_id}
          isHost={isBroadcaster}
          totalCoins={stream.total_gifts_coins}
          onSetPrice={() => {}} // Placeholder
          onJoinRequest={() => {}} // Placeholder
        >
          {/* Overlays */}
          <BroadcastOverlays
             title={stream.title}
             viewerCount={stream.current_viewers}
             isLive={stream.is_live}
             isBroadcaster={isBroadcaster}
             micOn={micOn}
             cameraOn={cameraOn}
             onToggleMic={toggleMic}
             onToggleCamera={toggleCamera}
             onOpenChat={() => setShowMobileChat(!showMobileChat)}
             onOpenGifts={() => setIsGiftModalOpen(true)}
             onOpenSettings={() => {}} // Placeholder
          />
          
          {/* Gift Event Animation */}
          {lastGift && <GiftEventOverlay gift={lastGift} onProfileClick={setSelectedProfile} />}
        </BroadcastLayout>
      </div>

      {/* Right Panel (Desktop Chat) */}
      <div className="hidden md:flex w-80 border-l border-white/10 flex-col bg-[#0b091f]">
        <div className="flex-1 min-h-0">
          <ChatBox 
            streamId={streamId || ''}
            onProfileClick={setSelectedProfile}
            onCoinSend={() => setIsGiftModalOpen(true)}
          />
        </div>
      </div>

      {/* Mobile Chat Sheet/Overlay */}
      {showMobileChat && (
        <div className="absolute inset-x-0 bottom-0 h-[50vh] bg-[#0b091f] rounded-t-2xl z-40 flex flex-col md:hidden animate-slideUp border-t border-white/10 shadow-2xl">
           <div className="flex justify-between items-center p-3 border-b border-white/5">
              <span className="font-bold text-sm">Live Chat</span>
              <button onClick={() => setShowMobileChat(false)} className="text-white/50 hover:text-white">Close</button>
           </div>
           <div className="flex-1 min-h-0">
             <ChatBox 
               streamId={streamId || ''}
               onProfileClick={setSelectedProfile}
               onCoinSend={() => setIsGiftModalOpen(true)}
             />
           </div>
        </div>
      )}

      {/* Modals */}
      {isGiftModalOpen && (
        <GiftModal 
          onClose={() => setIsGiftModalOpen(false)} 
          onSendGift={handleGiftSent} 
          recipientName={giftRecipient?.username || 'Broadcaster'} 
          profile={profile} 
        />
      )}
      
      {selectedProfile && (
        <ProfileModal 
          profile={selectedProfile} 
          onClose={() => setSelectedProfile(null)} 
          onSendCoins={() => {}} 
          onGift={(p) => { setGiftRecipient(p); setIsGiftModalOpen(true); }} 
          currentUser={user} 
        />
      )}
      
      {isCoinStoreOpen && <CoinStoreModal onClose={() => setIsCoinStoreOpen(false)} onPurchase={() => {}} />}
    </div>
  );
}
