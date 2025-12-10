import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function removeTrollOfficerRole() {
  try {
    console.log('🔄 Starting role removal process...');
    
    // Get current user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.log('❌ No authenticated user found. Please log in first.');
      return;
    }
    
    const userId = session.user.id;
    console.log('👤 Current user ID:', userId);
    
    // Check current profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (profileError) {
      console.error('❌ Error fetching profile:', profileError);
      return;
    }
    
    console.log('📋 Current profile:', {
      id: profile.id,
      username: profile.username,
      role: profile.role,
      troll_role: profile.troll_role,
      is_troll_officer: profile.is_troll_officer,
      is_lead_officer: profile.is_lead_officer
    });
    
    // Check if user is currently a troll officer
    const isCurrentlyTrollOfficer = profile.is_troll_officer || profile.role === 'troll_officer' || profile.troll_role === 'troll_officer';
    
    if (!isCurrentlyTrollOfficer) {
      console.log('✅ You are not currently a troll officer. No changes needed.');
      return;
    }
    
    console.log('🗑️ Removing troll officer role...');
    
    // Remove troll officer role
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        is_troll_officer: false,
        role: null,
        troll_role: null,
        is_officer_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select();
      
    if (error) {
      console.error('❌ Error updating profile:', error);
      return;
    }
    
    console.log('✅ Successfully removed troll officer role!');
    console.log('📋 Updated profile:', {
      id: data[0].id,
      username: data[0].username,
      role: data[0].role,
      troll_role: data[0].troll_role,
      is_troll_officer: data[0].is_troll_officer,
      is_lead_officer: data[0].is_lead_officer
    });
    
    console.log('');
    console.log('🎉 Role removal complete! You can now:');
    console.log('   • Apply for Lead Officer position');
    console.log('   • Refresh your browser to see changes');
    console.log('   • Visit /apply to start your Lead Officer application');
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

removeTrollOfficerRole();