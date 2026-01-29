import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { AlertTriangle, X, FileText, User } from 'lucide-react';

export default function UserCompliancePrompt() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const [missingItems, setMissingItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Don't show on onboarding pages or auth pages
  const isExcludedPage = 
    location.pathname.startsWith('/auth') || 
    location.pathname.startsWith('/officer/onboarding') ||
    location.pathname === '/profile' ||
    location.pathname === '/tax-onboarding' ||
    location.pathname === '/terms' ||
    location.pathname === '/';

  useEffect(() => {
    const checkCompliance = async () => {
      try {
        const missing = [];

        // Check Profile (Full Name is critical for compliance)
        const { data: profileRow } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();
        if (!profileRow?.full_name) {
          missing.push('profile');
        }

        // Check Tax Info
        // We check if a record exists in user_tax_info for this user
        const { data: taxData } = await supabase
          .from('user_tax_info')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!taxData) {
           missing.push('tax');
        }

        setMissingItems(missing);
        if (missing.length > 0) {
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }
      } catch (err) {
        console.error('Error checking compliance:', err);
      } finally {
        setLoading(false);
      }
    };

    if (!user || !profile || isExcludedPage) {
      setIsVisible(false);
      return;
    }

    checkCompliance();

    // Real-time subscription for tax info and profile updates
    const subscription = supabase
      .channel('compliance_check')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'user_tax_info',
        filter: `user_id=eq.${user.id}`
      }, () => {
        checkCompliance();
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'user_profiles',
        filter: `id=eq.${user.id}`
      }, (_payload) => {
         // Re-check compliance on any profile update
         checkCompliance();
       })
       .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, profile, isExcludedPage]);

  if (!isVisible || loading || missingItems.length === 0) return null;

  const completionPercentage = Math.round(((2 - missingItems.length) / 2) * 100);

  return (
    <div className="bg-gradient-to-r from-[#0b1329] via-[#11143a] to-[#2a0f3a] border-b border-pink-500/30 text-white p-3 relative z-40 animate-in slide-in-from-top duration-300">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-center sm:text-left">
          <div className="bg-pink-500/20 p-2 rounded-full animate-pulse hidden sm:block relative">
            <AlertTriangle className="w-5 h-5 text-pink-300" />
          </div>
          <div>
            <p className="font-bold text-sm flex items-center justify-center sm:justify-start gap-2">
              <AlertTriangle className="w-4 h-4 text-pink-300 sm:hidden" />
              Action Required ({completionPercentage}% Complete - {2 - missingItems.length}/2 Steps)
            </p>
            <p className="text-xs text-cyan-100">
              Please complete your {missingItems.includes('profile') && 'Profile (Full Name)'}
              {missingItems.includes('profile') && missingItems.includes('tax') && ' and '}
              {missingItems.includes('tax') && 'Tax Information'} to ensure full account access.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
          {missingItems.includes('profile') && (
            <button 
              onClick={() => navigate(profile?.username ? `/profile/${profile.username}` : '/profile/setup')}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-xs font-medium transition-colors border border-white/10"
            >
              <User className="w-3 h-3" />
              Update Profile
            </button>
          )}
          {missingItems.includes('tax') && (
            <button 
              onClick={() => navigate('/tax-onboarding')}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-xs font-medium transition-colors border border-white/10"
            >
              <FileText className="w-3 h-3" />
              Tax Info
            </button>
          )}
          <button 
            onClick={() => setIsVisible(false)}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors ml-1"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
