import { useEffect } from 'react';
import { useAgora } from '../../hooks/useAgora';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { useAuthStore } from '../../lib/store';

export default function MuteHandler({ streamId }: { streamId: string }) {
    const { localAudioTrack } = useAgora();
    const { user } = useAuthStore();

    useEffect(() => {
        if (!streamId || !streamId.trim() || !user?.id) return;

        const checkMute = async () => {
             const { data } = await supabase.from('stream_mutes').select('id').eq('stream_id', streamId).eq('user_id', user.id).maybeSingle();
             if (data) {
                 localAudioTrack?.setMuted(true);
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
                const data = (payload as any).new;
                if (data && data.user_id === user.id) {
                    localAudioTrack?.setMuted(true);
                    toast.error("You have been muted by a moderator.");
                }
            })
            .on('postgres_changes', { 
                event: 'DELETE', 
                schema: 'public', 
                table: 'stream_mutes', 
                filter: `stream_id=eq.${streamId}` 
            }, (payload) => {
                 const data = (payload as any).old;
                 if (data && data.user_id === user.id) {
                     localAudioTrack?.setMuted(false);
                     toast.success("You have been unmuted.");
                 }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [streamId, user?.id, localAudioTrack]);

    return null;
}
