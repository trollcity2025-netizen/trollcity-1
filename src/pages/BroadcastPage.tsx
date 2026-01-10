import React, {
  useEffect,
  useState
} from 'react';
import { useParams } from 'react-router-dom';
import { useLiveKit } from '../hooks/useLiveKit';
import { useAuthStore } from '../lib/store';
import { supabase, UserProfile } from '../lib/supabase';
import { toast } from 'sonner';
import ChatBox from '../components/broadcast/ChatBox';
import GiftBox from '../components/broadcast/GiftBox';
import GiftModal from '../components/broadcast/GiftModal';
import ProfileModal from '../components/broadcast/ProfileModal';
import CoinStoreModal from '../components/broadcast/CoinStoreModal';
import GiftEventOverlay from './GiftEventOverlay';
import { useGiftEvents } from '../lib/hooks/useGiftEvents';
import EntranceEffect from '../components/broadcast/EntranceEffect';
import BroadcastLayout from '../components/broadcast/BroadcastLayout';
import BroadcastOverlays from '../components/stream/BroadcastOverlays';
import { useSeatRoster } from '../hooks/useSeatRoster';
import SeatCostPopup from '../components/broadcast/SeatCostPopup';

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
  created_at: string;
}

export default function BroadcastPage() {
  const { streamId } = useParams();
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
  const [seatCostPopupVisible, setSeatCostPopupVisible] = useState(false);
  const [seatCost, setSeatCost] = useState<number>(0);
  const [joinPrice, setJoinPrice] = useState<number>(0);
  
  // LiveKit
  const liveKit = useLiveKit();

  // Seat Roster
  const { seats, claimSeat } = useSeatRoster(streamId || '');

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
        await liveKit.connect(streamId, user, {
          allowPublish: isBroadcaster,
          role: isBroadcaster ? 'host' : 'audience'
        });
        if (isBroadcaster) {
           await liveKit.toggleMicrophone();
           await liveKit.toggleCamera();
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
  }, [streamId, user, isBroadcaster, liveKit, profile]);

  // Enable camera and mic for guests when they join a seat
  useEffect(() => {
    if (!isBroadcaster && seats.some(seat => seat?.user_id === user?.id)) {
      const enableGuestMedia = async () => {
        try {
          // Disconnect and reconnect with publishing permissions
          await liveKit.disconnect();
          await liveKit.connect(streamId || '', user, {
            allowPublish: true,
            role: 'guest'
          });
          // Enable camera and mic for the guest
          await liveKit.toggleMicrophone();
          await liveKit.toggleCamera();
        } catch (err) {
          console.error('Failed to enable guest media:', err);
          toast.error('Failed to enable camera and mic');
        }
      };
      
      enableGuestMedia();
    }
  }, [isBroadcaster, seats, user, streamId, liveKit]);

  // Handlers
  const toggleMic = async () => {
    const newState = !micOn;
    setMicOn(newState);
    await liveKit.toggleMicrophone();
  };

  const toggleCamera = async () => {
    const newState = !cameraOn;
    setCameraOn(newState);
    await liveKit.toggleCamera();
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
  const [entranceEffect] = useState<any>(null);

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
          seats={seats}
          joinPrice={joinPrice}
          onSetPrice={(newPrice) => {
            // Update the join price state
            setJoinPrice(newPrice);
            // This would be used to update the price in the database
            console.log('Join price updated:', newPrice);
          }}
          onJoinRequest={async (seatIndex: number) => {
           try {
             // Show seat cost popup if there's a price set
             if (joinPrice > 0) {
               setSeatCost(joinPrice);
               setSeatCostPopupVisible(true);
             }
             
             await claimSeat(seatIndex, { joinPrice });
           } catch (err) {
             console.error('Failed to claim seat:', err);
             toast.error('Failed to join seat');
           }
         }}
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
             totalCoins={stream.total_gifts_coins}
             startTime={stream.created_at}
          />
          
          {/* Gift Event Animation */}
          {lastGift && <GiftEventOverlay gift={lastGift} onProfileClick={setSelectedProfile} />}
        </BroadcastLayout>
      </div>

      {/* Right Panel (Desktop Chat) */}
      <div className="hidden md:flex w-80 border-l border-white/10 flex-col bg-[#0b091f]">
        <div className="shrink-0">
           <GiftBox onSendGift={handleGiftSent} />
        </div>
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
          onGift={(p: UserProfile) => { setGiftRecipient(p); setIsGiftModalOpen(true); }}
          currentUser={user} 
        />
      )}
      
      {isCoinStoreOpen && <CoinStoreModal onClose={() => setIsCoinStoreOpen(false)} onPurchase={() => {}} />}
      
      {/* Seat Cost Popup - shows when joining a seat with a price */}
      {seatCostPopupVisible && (
        <SeatCostPopup
          cost={seatCost}
          onClose={() => setSeatCostPopupVisible(false)}
          duration={10000}
        />
      )}
    </div>
  );
}
