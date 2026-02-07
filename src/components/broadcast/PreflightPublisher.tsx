import { useEffect, useRef } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';

interface PreflightPublisherProps {
    stream: MediaStream;
    onPublished?: () => void;
}

export default function PreflightPublisher({ stream, onPublished }: PreflightPublisherProps) {
    const { localParticipant } = useLocalParticipant();
    const hasPublished = useRef(false);

    useEffect(() => {
        if (!localParticipant || hasPublished.current || !stream) return;

        // Check permissions - these are available on localParticipant
        if (!localParticipant.permissions) {
            console.log('[PreflightPublisher] Waiting for permissions object...');
            return;
        }

        if (!localParticipant.permissions.canPublish) {
            console.error('[PreflightPublisher] Permissions loaded but canPublish is FALSE', localParticipant.permissions);
            return;
        }

        const publish = async () => {
            console.log('[PreflightPublisher] Publishing preflight stream tracks...', {
                permissions: localParticipant.permissions,
                identity: localParticipant.identity
            });

            try {
                const videoTrack = stream.getVideoTracks()[0];
                const audioTrack = stream.getAudioTracks()[0];

                // Check if tracks are still active
                if (videoTrack && videoTrack.readyState === 'ended') {
                    console.warn('[PreflightPublisher] Video track is ended');
                }
                if (audioTrack && audioTrack.readyState === 'ended') {
                    console.warn('[PreflightPublisher] Audio track is ended');
                }

                if (videoTrack && videoTrack.readyState === 'live') {
                    // Force enable track to ensure it starts ON as requested
                    videoTrack.enabled = true;
                    await localParticipant.publishTrack(videoTrack, { 
                        name: 'camera',
                        source: Track.Source.Camera 
                    });
                }
                if (audioTrack && audioTrack.readyState === 'live') {
                    // Force enable track to ensure it starts ON as requested
                    audioTrack.enabled = true;
                    await localParticipant.publishTrack(audioTrack, { 
                        name: 'microphone',
                        source: Track.Source.Microphone 
                    });
                }
                
                hasPublished.current = true;
                if (onPublished) onPublished();
                
                console.log('[PreflightPublisher] Successfully published tracks');
            } catch (error) {
                console.error('[PreflightPublisher] Error publishing tracks:', error);
            }
        };

        publish();
    }, [
        localParticipant, 
        stream, 
        onPublished,
        localParticipant?.permissions
    ]);

    return null;
}
