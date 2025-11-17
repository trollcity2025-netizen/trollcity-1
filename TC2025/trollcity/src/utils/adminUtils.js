import { supabase } from '@/api/supabaseClient';

export async function checkCurrentUserRole() {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) {
      console.log('No user logged in');
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, is_admin, full_name, email')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }

    console.log('Current user:', data);
    console.log('Is admin:', data.role === 'admin' || data.is_admin);
    
    return data;
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

export async function makeCurrentUserAdmin() {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) {
      console.log('No user logged in');
      return false;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ 
        role: 'admin',
        is_admin: true 
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user:', error);
      return false;
    }

    console.log('User updated to admin successfully');
    return true;
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
}

export async function updateCurrentUserAdminStatus() {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) {
      console.log('No user logged in');
      return false;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ 
        is_admin: true 
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user admin status:', error);
      return false;
    }

    console.log('User admin status updated successfully');
    return true;
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
}