import React, {
  useEffect,
  useState
} from 'react';
import { useParams } from 'react-router-dom';
import { useLiveKit } from '../hooks/useLiveKit';
import { useAuthStore } from '../lib/store';
import { supabase, UserProfile } from '../lib/supabase';
import { toast } from 'sonner';
import { useViewerTracking } from '../hooks/useViewerTracking';
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
  const isGuestSeat = !isBroadcaster && seats.some(seat => seat?.user_id === user?.id);
  
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
        // Don't show toast if user is just not logged in yet, as it might be a public stream check
        if (user) {
           toast.error('Failed to load stream');
        }
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
          allowPublish: isBroadcaster || isGuestSeat,
          role: isBroadcaster ? 'host' : (isGuestSeat ? 'guest' : 'audience')
        });
        if (isBroadcaster) {
           // Enable camera and mic for broadcaster using consistent logic
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
  }, [streamId, user, isBroadcaster, isGuestSeat, liveKit, profile]);

  // Track viewers for this stream
  useViewerTracking(streamId || '', user?.id || null);

  // Enable camera and mic for guests when they join a seat
  useEffect(() => {
    if (!isBroadcaster && seats.some(seat => seat?.user_id === user?.id)) {
      const enableGuestMedia = async () => {
        try {
          // Check if already publishing
          const currentRoom = liveKit.getRoom();
          const isAlreadyPublishing = currentRoom?.localParticipant?.videoTrackPublications.size > 0 ||
                                    currentRoom?.localParticipant?.audioTrackPublications.size > 0;
          
          if (!isAlreadyPublishing) {
            // Enable camera and mic for the guest without disconnecting
            // Use explicit enable calls instead of toggle to avoid turning off existing streams
            const micEnabled = await liveKit.enableMicrophone();
            const cameraEnabled = await liveKit.enableCamera();
            
            // Set local state to reflect media is on
            setMicOn(micEnabled);
            setCameraOn(cameraEnabled);
            
            // Debug: Log the media state after enabling
            console.log('Guest media enabled:', { micEnabled, cameraEnabled });
          }
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

  // Invite Followers Function
  const handleInviteFollowers = async () => {
    try {
      if (!stream) {
        toast.error('Stream not loaded');
        return;
      }

      // Send notifications to broadcaster's followers
      const { data: followers, error: followersError } = await supabase
        .from('followers')
        .select('follower_id')
        .eq('user_id', stream.broadcaster_id);

      if (followersError) {
        console.error('Error fetching followers:', followersError);
        toast.error('Failed to fetch followers');
        return;
      }

      if (followers && followers.length > 0) {
        // Send notification to each follower
        const followerIds = followers.map(f => f.follower_id);
        
        // Insert notifications into the database
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert(followerIds.map(followerId => ({
            user_id: followerId,
            type: 'stream_invite',
            title: 'Live Stream Invitation',
            message: `${profile?.username || 'A broadcaster'} has invited you to join their live stream!`,
            metadata: {
              stream_id: streamId,
              broadcaster_id: stream.broadcaster_id,
              broadcaster_name: profile?.username || 'Broadcaster'
            },
            is_read: false,
            created_at: new Date().toISOString()
          })));

        if (notificationError) {
          console.error('Error sending notifications:', notificationError);
          toast.error('Failed to send some invitations');
        } else {
          toast.success(`Invitations sent to ${followerIds.length} followers!`);
        }
      } else {
        toast.info('No followers to invite');
      }
    } catch (err) {
      console.error('Error inviting followers:', err);
      toast.error('Failed to invite followers');
    }
  };

  // External Share Link Function
  const handleShareStream = async () => {
    try {
      if (!streamId) {
        toast.error('Stream ID not available');
        return;
      }

      // Generate shareable link
      const shareLink = `${window.location.origin}/stream/${streamId}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(shareLink);

      // Show success message
      toast.success('Stream link copied to clipboard!');

      // Also show a system share dialog if available
      if (navigator.share) {
        try {
          await navigator.share({
            title: stream?.title || 'TrollCity Live Stream',
            text: `Join ${profile?.username || 'this broadcaster'}'s live stream on TrollCity!`,
            url: shareLink
          });
        } catch {
          // User canceled the share dialog, which is fine
          console.log('User canceled share dialog');
        }
      }
    } catch (err) {
      console.error('Error sharing stream:', err);
      toast.error('Failed to copy stream link');
    }
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
         onDisableGuestMedia={liveKit.disableGuestMediaByClick}
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
             onInviteFollowers={handleInviteFollowers}
             onShareStream={handleShareStream}
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
            room={liveKit.getRoom()}
            isBroadcaster={isBroadcaster}
          />
        </div>
      </div>

      {/* Mobile Chat Sheet/Overlay */}
      {showMobileChat && (
        <div className="absolute inset-x-0 bottom-0 h-[65vh] bg-[#0b091f] rounded-t-2xl z-40 flex flex-col md:hidden animate-slideUp border-t border-white/10 shadow-2xl">
           <div className="flex justify-between items-center p-3 border-b border-white/5">
              <span className="font-bold text-sm">Live Chat</span>
              <button onClick={() => setShowMobileChat(false)} className="text-white/50 hover:text-white">Close</button>
           </div>
           <div className="flex-1 min-h-0">
             <ChatBox
               streamId={streamId || ''}
               onProfileClick={setSelectedProfile}
               onCoinSend={() => setIsGiftModalOpen(true)}
               room={liveKit.getRoom()}
               isBroadcaster={isBroadcaster}
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
