import { supabase } from "./supabaseClient";
import { addOGBadgeIfEligible } from "./admin";

/**
 * Handle user registration with OG badge eligibility check
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} Registration result
 */
export async function handleUserRegistration(userData) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          username: userData.username,
          full_name: userData.fullName,
        }
      }
    });

    if (error) throw error;

    // Check and add OG badge if eligible
    if (data.user) {
      await addOGBadgeIfEligible(data.user.id);
      console.log(`✅ User registration completed for ${userData.username}`);
    }

    return { success: true, user: data.user, session: data.session };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle user login with OG badge check
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} Login result
 */
export async function handleUserLogin(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Check and add OG badge if eligible (for existing users who haven't got it yet)
    if (data.user) {
      const badgeAdded = await addOGBadgeIfEligible(data.user.id);
      if (badgeAdded) {
        console.log(`✅ OG badge added to existing user ${data.user.email}`);
      }
    }

    return { success: true, user: data.user, session: data.session };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle role assignment with Troll Officer coin award
 * @param {string} userId - User ID
 * @param {string} newRole - New role to assign
 * @returns {Promise<Object>} Role assignment result
 */
export async function handleRoleAssignment(userId, newRole) {
  try {
    // Update user role
    const { error: roleError } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (roleError) throw roleError;

    // Award coins if user became Troll Officer (feature removed)
    if (newRole === 'troll_officer') {
      console.log(`Troll Officer feature removed - no coins awarded to ${userId}`);
    }

    return { success: true, message: `Role updated to ${newRole}` };
  } catch (error) {
    console.error('Role assignment error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user profile with badges
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User profile with badges
 */
export async function getUserProfileWithBadges(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, badges, role, created_at, free_coins, purchased_coins')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return { success: true, profile: data };
  } catch (error) {
    console.error('Error getting user profile:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Display user badges in UI format
 * @param {Array} badges - Array of badge names
 * @returns {Array} Formatted badge components
 */
export function formatUserBadges(badges = []) {
  const badgeConfig = {
    'OG': {
      name: 'OG',
      color: 'bg-gradient-to-r from-yellow-400 to-orange-500',
      icon: '👑',
      tooltip: 'Original Gangster - Joined before Dec 31, 2025'
    },
    'TROLL_OFFICER': {
      name: 'Troll Officer',
      color: 'bg-gradient-to-r from-blue-500 to-purple-600',
      icon: '🎖️',
      tooltip: 'Troll Officer - Community Moderator'
    },
    'VIP': {
      name: 'VIP',
      color: 'bg-gradient-to-r from-purple-500 to-pink-500',
      icon: '💎',
      tooltip: 'Very Important Player'
    },
    'STREAMER': {
      name: 'Streamer',
      color: 'bg-gradient-to-r from-red-500 to-pink-500',
      icon: '📺',
      tooltip: 'Content Creator'
    }
  };

  return badges.map(badge => {
    const config = badgeConfig[badge] || {
      name: badge,
      color: 'bg-gray-600',
      icon: '🏷️',
      tooltip: badge
    };

    return {
      ...config,
      key: badge
    };
  });
}