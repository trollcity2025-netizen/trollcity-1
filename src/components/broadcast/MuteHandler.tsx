import { useEffect } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

export default function MuteHandler({ streamId }: { streamId: string }) {
    const { localParticipant } = useLocalParticipant();

    useEffect(() => {
        if (!localParticipant) return;

        // Check initial mute
        const checkMute = async () => {
             const { data } = await supabase.from('stream_mutes').select('id').eq('stream_id', streamId).eq('user_id', localParticipant.identity).maybeSingle();
             if (data) {
                 localParticipant.setMicrophoneEnabled(false);
                 toast.error("You have been muted by a moderator.");
             }
        };
        checkMute();

        const channel = supabase.channel(`mutes:${streamId}`)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'stream_mutes', 
                filter: `stream_id=eq.${streamId}` 
            }, (payload) => {
                // @ts-ignore
                if (payload.new.user_id === localParticipant.identity) {
                    localParticipant.setMicrophoneEnabled(false);
                    toast.error("You have been muted by a moderator.");
                }
            })
            .on('postgres_changes', { 
                event: 'DELETE', 
                schema: 'public', 
                table: 'stream_mutes', 
                filter: `stream_id=eq.${streamId}` 
            }, (payload) => {
                 // @ts-ignore
                 if (payload.old.user_id === localParticipant.identity) {
                     localParticipant.setMicrophoneEnabled(true);
                     toast.success("You have been unmuted.");
                 }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [streamId, localParticipant]);

    return null;
}
