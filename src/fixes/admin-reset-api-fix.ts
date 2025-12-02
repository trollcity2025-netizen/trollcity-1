// Fix for "api is not defined" in AdminResetPanel
// Replace api calls with direct supabase/fetch calls

import { supabase } from '../lib/supabase';

export const resetTestData = async () => {
  const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
    'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1';
  
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const response = await fetch(`${edgeFunctionsUrl}/admin-reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      action: 'reset_test_data'
    })
  });

  const data = await response.json();
  return data;
};

export const resetLiveStreams = async () => {
  const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
    'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1';
  
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const response = await fetch(`${edgeFunctionsUrl}/admin-reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      action: 'reset_live_streams'
    })
  });

  const data = await response.json();
  return data;
};

export const resetCoinBalances = async () => {
  const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
    'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1';
  
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const response = await fetch(`${edgeFunctionsUrl}/admin-reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      action: 'reset_coin_balances'
    })
  });

  const data = await response.json();
  return data;
};

// In AdminResetPanel.tsx, replace api.post('/admin-reset', ...) with these functions

