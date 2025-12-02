// Fix for lead officer application in Application.tsx
// Add lead officer application option with position filled check

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

export const useLeadOfficerApplication = () => {
  const { profile, user } = useAuthStore();
  const [positionFilled, setPositionFilled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPosition = async () => {
      try {
        const { data, error } = await supabase.rpc('is_lead_officer_position_filled');
        if (error) throw error;
        setPositionFilled(data || false);
      } catch (error: any) {
        console.error('Error checking lead officer position:', error);
      } finally {
        setLoading(false);
      }
    };

    checkPosition();
  }, []);

  const submitLeadOfficerApplication = async () => {
    if (!user || !profile) {
      throw new Error('You must be logged in');
    }

    if (positionFilled) {
      throw new Error('Lead officer position is already filled');
    }

    try {
      const { data, error } = await supabase
        .from('applications')
        .insert({
          user_id: user.id,
          type: 'lead_officer',
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error: any) {
      console.error('Error submitting lead officer application:', error);
      throw error;
    }
  };

  return {
    positionFilled,
    loading,
    submitLeadOfficerApplication,
    canApply: !positionFilled && !loading
  };
};

// In Application.tsx, add:
// const { positionFilled, loading: positionLoading, submitLeadOfficerApplication, canApply } = useLeadOfficerApplication();
// 
// Then in the application types list:
// {
//   type: 'lead_officer',
//   label: 'Lead Officer',
//   description: 'Manage Troll Officers and approve applications',
//   disabled: positionFilled,
//   disabledReason: positionFilled ? 'Position already filled' : undefined
// }

