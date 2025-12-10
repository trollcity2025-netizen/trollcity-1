// src/lib/fetchApplications.js
import { supabase } from '@/lib/supabaseClient';

// ---------------------------------------------
// Fix unrouted/broken applications
// ---------------------------------------------
export async function fixBrokenApplications() {
  // Find apps missing required fields
  const { data: broken, error } = await supabase
    .from('applications')
    .select('*')
    .or('status.is.null,type.is.null,user_id.is.null');

  if (error) {
    console.error('Failed to fetch broken applications:', error);
    return;
  }

  if (!broken || broken.length === 0) return;

  for (const app of broken) {
    const fixed = {
      status: app.status ?? 'pending',
      type: app.type ?? app.form_type ?? 'troller',
      user_id: app.user_id ?? app.auth_user_id ?? null,
    };

    await supabase
      .from('applications')
      .update(fixed)
      .eq('id', app.id);
  }
}

// ---------------------------------------------
// Fetch ALL applications (Admin Dashboard)
// ---------------------------------------------
export async function getAllApplications() {
  await fixBrokenApplications();

  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .or('status.eq.pending,status.is.null')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading applications:', error);
    return [];
  }
  return data;
}

// ---------------------------------------------
// Fetch only OFFICER applications (HQ)
// ---------------------------------------------
export async function getOfficerApplications() {
  await fixBrokenApplications();

  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .or('type.eq.troll_officer,type.eq.lead_troll_officer')
    .or('status.eq.pending,status.is.null')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading officer applications:', error);
    return [];
  }
  return data;
}

// ---------------------------------------------
// Create new application (Application Page)
// ---------------------------------------------
export async function submitApplication(payload) {
  const { data, error } = await supabase
    .from('applications')
    .insert([
      {
        user_id: payload.user_id,
        user_name: payload.user_name ?? '',
        user_email: payload.user_email ?? '',
        type: payload.type,
        status: 'pending',
        training_answers: payload.training_answers || {},
        simulation_answers: payload.simulation_answers || {},
      },
    ])
    .select('*')
    .single();

  if (error) {
    console.error('Application submission failed:', error);
    throw error;
  }
  return data;
}