import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Video, Gift, Send } from 'lucide-react';
import BroadcasterApplicationForm from '../components/BroadcasterApplicationForm';
import { toast } from 'sonner';

interface GoLiveProps {
  className?: string;
}

const GoLive: React.FC<GoLiveProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuthStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [streamTitle, setStreamTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [isTestingMode, setIsTestingMode] = useState(false);
  const [broadcasterStatus, setBroadcasterStatus] = useState<{
    isApproved: boolean;
    hasApplication: boolean;
    applicationStatus: string | null;
  } | null>(null);

  // Check broadcaster status on mount
  useEffect(() => {
    const checkBroadcasterStatus = async () => {
      const { profile, user } = useAuthStore.getState();
      if (!user || !profile) return;

      // Check if user is already approved broadcaster
      if (profile.is_broadcaster) {
        setBroadcasterStatus({
          isApproved: true,
          hasApplication: true,
          applicationStatus: 'approved'
        });
        return;
      }

      // Check for existing application
      const { data: existingApp } = await supabase
        .from('broadcaster_applications')
        .select('application_status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingApp) {
        setBroadcasterStatus({
          isApproved: existingApp.application_status === 'approved',
          hasApplication: true,
          applicationStatus: existingApp.application_status
        });
      } else {
        setBroadcasterStatus({
          isApproved: false,
          hasApplication: false,
          applicationStatus: null
        });
      }
    };

    checkBroadcasterStatus();
  }, []);

  // Auto cleanup if host closes tab or navigates away
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isStreaming && streamId) {
        // Fire and forget - browsers may ignore async but it's better than nothing
        callEndStreamFunction(streamId);
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      // Also cleanup on component unmount
      if (streamId && isStreaming) {
        callEndStreamFunction(streamId);
      }
    };
  }, [isStreaming, streamId]);

  const handleStartStream = async () => {
    const { profile } = useAuthStore.getState();
    if (!user || !profile) {
      setError('You must be logged in to go live');
      return;
    }

    // Check onboarding status
    if (profile.w9_status && !['submitted', 'verified'].includes(profile.w9_status)) {
      toast.error('Please complete creator onboarding before going live', {
        description: 'You need to submit your W9 information first.',
        action: {
          label: 'Go to Onboarding',
          onClick: () => navigate('/onboarding/creator'),
        },
      });
      navigate('/onboarding/creator');
      return;
    }

    // Check broadcaster approval (skip in testing mode for orientation)
    if (!profile.is_broadcaster && !isTestingMode) {
      toast.error("🚫 You must be an approved broadcaster to go live.");
      navigate("/");
      return;
    }

    if (!roomName.trim() || !streamTitle.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Generate a UUID for the stream ID (using crypto.randomUUID if available, otherwise fallback)
      const streamId = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : `${Date.now()}-${Math.random().toString(36).substring(2, 11)}-${Math.random().toString(36).substring(2, 11)}`;

      // 1️⃣ Save or update stream in Supabase
      const { data: streamRecord, error: dbError } = await supabase
        .from('streams')
        .insert({
          id: streamId,
          broadcaster_id: profile.id, // Use profile.id instead of user.id
          title: streamTitle,
          is_live: true,
          status: 'live',
          start_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (dbError || !streamRecord) {
        console.error('Stream creation error:', dbError);
        throw new Error(dbError?.message || 'Failed to create/update stream in Supabase');
      }

      // Award birthday coins if eligible (when user goes live on their birthday)
      try {
        const { data: birthdayResult, error: birthdayError } = await supabase.rpc('award_birthday_coins_if_eligible', {
          p_user_id: profile.id
        });
        if (birthdayError) {
          console.warn('Birthday coin check error:', birthdayError);
        } else if (birthdayResult?.success) {
          toast.success(`🎉 Happy Birthday! You received ${birthdayResult.coins_awarded} paid coins!`);
          // Refresh profile to show updated balance
          const { data: updatedProfile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', profile.id)
            .single();
          if (updatedProfile) {
            useAuthStore.getState().setProfile(updatedProfile as any);
          }
        }
      } catch (birthdayErr) {
        // Non-critical error, log but don't fail stream creation
        console.warn('Birthday coin check failed:', birthdayErr);
      }

      // 2️⃣ Get LiveKit token using Edge function
      // Use streamId as room name for consistency (so it's available on page refresh)
      const tokenResp = await api.post('/livekit-token', {
        room: streamId, // Use streamId instead of roomName for consistency
        identity: user.email || user.id,
        isHost: true,
      });

      // Check if the request was successful
      if (!tokenResp?.success && tokenResp?.error) {
        console.error('LiveKit token error:', tokenResp);
        throw new Error(tokenResp.error);
      }

      // The API returns 'livekitUrl' but we need to check for it
      const serverUrl = tokenResp?.livekitUrl || tokenResp?.serverUrl;
      let token = tokenResp?.token;
      
      // Ensure token is a string, not an object
      if (token && typeof token !== 'string') {
        console.warn('Token is not a string, extracting:', token);
        token = typeof token === 'object' && token?.token 
          ? token.token 
          : String(token);
      }
      
      if (!token || !serverUrl) {
        console.error('LiveKit token response:', tokenResp);
        throw new Error(tokenResp?.error || 'LiveKit token missing token or serverUrl');
      }

      // Validate token is a proper JWT string
      if (typeof token !== 'string' || token.length < 10) {
        console.error('Invalid token format:', typeof token, token);
        throw new Error('Invalid token format received from server');
      }

      setIsStreaming(true);
      setStreamId(streamId); // Store streamId in state
      
      // 3️⃣ Navigate to StreamRoom with the streamId in the URL
      navigate(`/stream/${streamId}`, {
        state: {
          roomName: streamId, // Use streamId as roomName for consistency
          serverUrl: serverUrl,
          token: token, // Ensure it's a string
          streamTitle,
          isHost: true,
        },
      });

    } catch (err: any) {
      console.error('Stream start error:', err);
      setError(err.message || 'Failed to start stream');
    } finally {
      setIsConnecting(false);
    }
  };

  // Store media stream ref for cleanup
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Request camera access and show preview
  useEffect(() => {
    if (videoRef.current && !isStreaming) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          mediaStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.error('Error accessing camera:', err);
        });
    }

    return () => {
      // Stop all tracks when component unmounts or user navigates away
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        mediaStreamRef.current = null;
      }
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [isStreaming]);

  // Cleanup on unmount or when navigating away
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  // Cleanup when navigating away from page
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, []);

  // Call end-stream edge function
  const callEndStreamFunction = async (id: string) => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const functionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
        'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1';

      await fetch(`${functionsUrl}/live`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ 
          action: 'end',
          stream_id: id 
        }),
      }).catch((e) => {
        console.error('Failed to call end-stream:', e);
      });
    } catch (error) {
      console.error('Error calling end-stream function:', error);
    }
  };

  // Handle ending the stream
  const handleEndStream = async () => {
    if (!streamId) {
      toast.error('No active stream to end');
      return;
    }

    try {
      // Call end-stream function
      await callEndStreamFunction(streamId);

      // Update local state
      setIsStreaming(false);
      setStreamId(null);
      setRoomName('');
      setStreamTitle('');

      toast.success('Stream ended successfully');
      navigate('/'); // Send broadcaster to homepage
    } catch (error: any) {
      console.error('Error ending stream:', error);
      toast.error(error.message || 'Failed to end stream');
    }
  };

  const handleApplicationSubmitted = async () => {
    // Reload profile to check for updates
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', useAuthStore.getState().user?.id)
      .single();

    if (profileData) {
      useAuthStore.getState().setProfile(profileData);
    }

    // Check application status
    const { data: app } = await supabase
      .from('broadcaster_applications')
      .select('application_status')
      .eq('user_id', useAuthStore.getState().user?.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (app) {
      setBroadcasterStatus({
        isApproved: app.application_status === 'approved',
        hasApplication: true,
        applicationStatus: app.application_status
      });
    }

    toast.success('Application submitted! An admin will review it shortly.');
  };

  return (
    <div className={`go-live-wrapper ${className}`}>
      <BroadcasterApplicationForm
        isOpen={showApplicationForm}
        onClose={() => setShowApplicationForm(false)}
        onSubmitted={handleApplicationSubmitted}
      />

      {/* Show status message if not approved */}
      {broadcasterStatus && !broadcasterStatus.isApproved && (
        <div className="max-w-6xl mx-auto mb-6">
          <div className={`bg-[#0E0A1A] rounded-xl border p-6 ${
            broadcasterStatus.applicationStatus === 'pending' 
              ? 'border-yellow-500/40 bg-yellow-500/10' 
              : broadcasterStatus.applicationStatus === 'rejected'
              ? 'border-red-500/40 bg-red-500/10'
              : 'border-purple-500/40'
          }`}>
            <h3 className="text-lg font-semibold text-white mb-2">
              {broadcasterStatus.applicationStatus === 'pending' 
                ? '⏳ Application Pending Review'
                : broadcasterStatus.applicationStatus === 'rejected'
                ? '❌ Application Rejected'
                : '📝 Broadcaster Application Required'}
            </h3>
            <p className="text-gray-300 mb-4">
              {broadcasterStatus.applicationStatus === 'pending'
                ? 'Your broadcaster application is currently under review. You will be notified once it\'s approved.'
                : broadcasterStatus.applicationStatus === 'rejected'
                ? 'Your broadcaster application was rejected. Please contact support for more information.'
                : 'To go live, you must first submit a broadcaster application. Click the button below to get started.'}
            </p>
            {!broadcasterStatus.hasApplication && (
              <button
                onClick={() => setShowApplicationForm(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
              >
                Submit Application
              </button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-extrabold mb-6 flex items-center gap-2">
          <Video className="text-troll-gold w-8 h-8" />
          Go Live
        </h1>

        {/* Host Video Preview Box */}
        <div className="host-video-box">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover"
          />
          {!isStreaming && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <p className="text-white text-lg">Camera Preview</p>
            </div>
          )}
        </div>

        {/* Stream Setup Form */}
        {!isStreaming ? (
          <div className="bg-[#0E0A1A] rounded-xl border border-purple-700/40 p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Stream Title *
              </label>
              <input
                type="text"
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                placeholder="Enter your stream title..."
                className="w-full px-4 py-3 bg-[#171427] border border-purple-500/40 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                disabled={isConnecting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Room Name *
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Enter room name..."
                className="w-full px-4 py-3 bg-[#171427] border border-purple-500/40 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                disabled={isConnecting}
              />
            </div>

            {/* Thumbnail Upload */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Stream Thumbnail (Optional)
              </label>
              <div className="space-y-2">
                {thumbnailPreview && (
                  <div className="relative w-full h-48 rounded-lg overflow-hidden border border-purple-500/40">
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setThumbnailFile(null);
                        setThumbnailPreview(null);
                      }}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error('Image must be less than 5MB');
                        return;
                      }
                      setThumbnailFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setThumbnailPreview(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full px-4 py-3 bg-[#171427] border border-purple-500/40 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 file:cursor-pointer"
                  disabled={isConnecting || uploadingThumbnail}
                />
                <p className="text-xs text-gray-400">Recommended: 1280x720px, max 5MB</p>
              </div>
            </div>

            {/* Testing Mode for Orientation */}
            {profile && !profile.is_broadcaster && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="testing-mode"
                  checked={isTestingMode}
                  onChange={(e) => setIsTestingMode(e.target.checked)}
                  className="w-4 h-4 rounded border-purple-500 bg-[#171427] text-purple-600 focus:ring-purple-500"
                  disabled={isConnecting}
                />
                <label htmlFor="testing-mode" className="text-sm text-gray-300 cursor-pointer">
                  Testing Mode (Allow non-approved users to join broadcast boxes for orientation)
                </label>
              </div>
            )}

            {error && (
              <div className="bg-red-900/30 border border-red-600 text-red-200 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              onClick={handleStartStream}
              disabled={isConnecting || !roomName.trim() || !streamTitle.trim()}
              className="w-full py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black hover:from-[#FFA500] hover:to-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.6)] transition-all"
            >
              {isConnecting ? (
                <>Starting Stream...</>
              ) : (
                <>
                  <Video className="w-5 h-5" />
                  Go Live
                </>
              )}
            </button>
          </div>
        ) : !broadcasterStatus?.isApproved ? (
          <div className="bg-[#0E0A1A] rounded-xl border border-purple-700/40 p-6">
            <p className="text-gray-400 text-center">
              Please complete your broadcaster application to go live.
            </p>
          </div>
        ) : (
          <div className="bg-[#0E0A1A] rounded-xl border border-purple-700/40 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{streamTitle}</h2>
                <p className="text-sm text-gray-400">Room: {roomName}</p>
              </div>
              <button
                onClick={handleEndStream}
                className="btn-danger py-2 px-4 rounded-lg font-semibold flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                🔴 End Live
              </button>
            </div>

            {/* Chat Input */}
            <div className="chat-input-box">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Say something..."
                className="flex-1 bg-transparent text-white border-none outline-none placeholder-gray-500"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && chatInput.trim()) {
                    // Handle chat send
                    setChatInput('');
                  }
                }}
              />
              <button
                onClick={() => {
                  if (chatInput.trim()) {
                    // Handle chat send
                    setChatInput('');
                  }
                }}
                className="text-purple-400 hover:text-purple-300 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>

            {/* Gift Button */}
            <button className="btn-gift w-full py-2 px-4 rounded-lg font-semibold flex items-center justify-center gap-2">
              <Gift className="w-5 h-5" />
              Send Gift
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoLive;
