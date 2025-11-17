import { supabase } from "@/api/supabaseClient";

export async function getCurrentUserProfile() {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .limit(1)
      .single();
    if (error) return null;
    const u = data || null;
    if (!u) return null;
    return { 
      ...u, 
      avatar: u.avatar ?? u.avatar_url ?? u.user_metadata?.avatar_url ?? u.user_metadata?.avatar ?? null 
    };
  } catch (_) {
    return null;
  }
}

export async function ensureUserProfile() {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return null;

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (existingProfile) {
      return existingProfile;
    }

    // Create profile if it doesn't exist
    const username = user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`;
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        username: username,
        full_name: username,
        role: 'user',
        is_admin: false,
        is_troll_officer: false,
        is_troller: false,
        is_broadcaster: false,
        level: 1,
        coins: 0,
        free_coins: 0,
        purchased_coins: 0,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating user profile:', createError);
      return null;
    }

    console.log('Created new user profile:', newProfile);
    return newProfile;
  } catch (error) {
    console.error('Error ensuring user profile:', error);
    return null;
  }
}
