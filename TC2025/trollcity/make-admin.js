// Make current user admin script
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qaffpsbiciegxxonsxzl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhZmZwc2JpY2llZ3h4b25zeHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NDEyMzgsImV4cCI6MjA3ODMxNzIzOH0.qdudRjHRnK2Ys7mQpn4I4PFSJgs2JqM9PTD9h7q5dLk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function makeUserAdmin() {
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('No user logged in or auth error:', authError?.message);
      return;
    }
    
    console.log('Current user ID:', user.id);
    
    // Update user to admin
    const { error } = await supabase
      .from('profiles')
      .update({ 
        role: 'admin',
        is_admin: true,
        is_troll_officer: true
      })
      .eq('id', user.id);
    
    if (error) {
      console.error('Error updating user:', error.message);
      return;
    }
    
    console.log('✅ User is now admin and troll officer!');
    console.log('Refresh the page to see TFam in sidebar');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

makeUserAdmin();