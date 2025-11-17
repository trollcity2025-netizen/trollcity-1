import { useEffect, useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function useKickCheck() {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [isKicked, setIsKicked] = useState(false);

  useEffect(() => {
    const checkKickStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsChecking(false);
          return;
        }

        // Check if user has been kicked
        const { data: kickedRecord } = await supabase
          .from('kicked_users')
          .select('id, kicked_at, reason')
          .eq('user_id', user.id)
          .single();

        if (kickedRecord) {
          setIsKicked(true);
          // Redirect to payment page
          navigate('/store', { 
            state: { 
              kickReason: kickedRecord.reason,
              kickedAt: kickedRecord.kicked_at
            }
          });
          toast.error('Your account requires payment to continue. Please purchase coins to restore access.');
        }
      } catch (error) {
        // No kick record found or error checking - this is normal
        console.log('Kick check completed - no restrictions');
      } finally {
        setIsChecking(false);
      }
    };

    checkKickStatus();

    // Set up real-time subscription for kick updates
    const channel = supabase
      .channel('kick-check')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'kicked_users',
        filter: `user_id=eq.${(async () => {
          const { data: { user } } = await supabase.auth.getUser();
          return user?.id || '';
        })()}`
      }, (payload) => {
        if (payload.new.user_id === (async () => {
          const { data: { user } } = await supabase.auth.getUser();
          return user?.id;
        })()) {
          setIsKicked(true);
          navigate('/store', { 
            state: { 
              kickReason: payload.new.reason,
              kickedAt: payload.new.kicked_at
            }
          });
          toast.error('Your account requires payment to continue. Please purchase coins to restore access.');
        }
      });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  return { isChecking, isKicked };
}