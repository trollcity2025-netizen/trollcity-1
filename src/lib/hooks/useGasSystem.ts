import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { supabase } from '../supabase';
import { toast } from 'sonner';

const EXCLUDED_PATHS = [
  '/auth',
  '/login',
  '/signup',
  '/callback',
  '/profile/setup',
  '/terms',
  '/store',
  '/coins'
];

export function useGasSystem() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, refreshProfile, setProfile } = useAuthStore();
  const lastPathRef = useRef<string | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    if (!user || !profile) return;
    if (processingRef.current) return;

    const path = location.pathname;
    
    // Check if path is excluded from gas consumption
    const isExcluded = EXCLUDED_PATHS.some(p => path.startsWith(p));
    
    // Gas Blocking Logic
    const gas = profile.gas_balance ?? 100;
    const isStaff = ['admin', 'secretary', 'troll_officer', 'lead_troll_officer'].includes(profile.role || '');
    
    // Allow move if gas is exactly 5 (cost of one move)
    if (gas < 1 && !isExcluded && !isStaff) {
            // Allow staying on auth/setup pages even if gas is low
            if (!['/auth', '/profile/setup', '/terms'].some(p => path.startsWith(p))) {
                toast.error('Out of gas! You must refill to continue traveling.');
                // Open modal instead of navigating away
                window.dispatchEvent(new CustomEvent('open-gas-station'));
                return;
            }
        }

    // Gas Consumption Logic
    // Only consume if path changed (and not just query params)
    if (lastPathRef.current !== path && !isExcluded) {
        lastPathRef.current = path;
        
        // Don't consume if we are already low (prevent going negative/redundant calls before redirect)
        if (gas < 1 && !isStaff) return;

        console.log(`[GasSystem] Consuming gas on path change: ${lastPathRef.current} -> ${path}. Current gas: ${gas}`);

        const consumeGas = async () => {
            try {
                processingRef.current = true;
                const { data, error } = await supabase.rpc('consume_gas', { p_amount: 1 });
                
                if (error) {
                    console.error('Gas consumption error:', error);
                } else if (data && data.success) {
                    console.log(`[GasSystem] Gas consumed. New balance: ${data.new_balance}`);
                    // Update local profile to reflect new gas
                    // data.new_balance
                    setProfile({ ...profile, gas_balance: data.new_balance });
                    
                    if (data.new_balance <= 5 && !isStaff) {
                        toast.error('Warning: Gas is critically low!');
                    }
                }
            } catch (err) {
                console.error('Gas system error:', err);
            } finally {
                processingRef.current = false;
            }
        };

        consumeGas();
    }
  }, [location.pathname, user, profile, navigate, setProfile]);
}
