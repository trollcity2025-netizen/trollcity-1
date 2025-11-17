import { supabase } from "./supabaseClient";

/**
 * Get admin-editable content for a specific page
 * @param {string} pageName - Name of the page (e.g., 'Store', 'GamblePage', 'Home')
 * @param {string} fieldName - Name of the field (default: 'content')
 * @returns {Promise<string>} The content for the page
 */
export async function getAdminContent(pageName, fieldName = "content") {
  try {
    const { data, error } = await supabase
      .rpc('get_admin_content', {
        page_name_param: pageName,
        field_name_param: fieldName
      });

    if (error) {
      console.warn(`No admin content found for ${pageName}.${fieldName}`);
      return "";
    }

    return data || "";
  } catch (error) {
    console.error(`Error getting admin content for ${pageName}.${fieldName}:`, error);
    return "";
  }
}

/**
 * Update admin-editable content for a specific page
 * @param {string} pageName - Name of the page
 * @param {string} content - New content
 * @param {string} fieldName - Name of the field (default: 'content')
 * @returns {Promise<boolean>} Success status
 */
export async function updateAdminContent(pageName, content, fieldName = "content") {
  try {
    // First, deactivate any existing active content for this page/field
    const { error: deactivateError } = await supabase
      .from('admin_content')
      .update({ is_active: false })
      .eq('page_name', pageName)
      .eq('field_name', fieldName)
      .eq('is_active', true);

    if (deactivateError) {
      console.error('Error deactivating old content:', deactivateError);
      throw deactivateError;
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Insert new content
    const { error: insertError } = await supabase
      .from('admin_content')
      .insert({
        page_name: pageName,
        field_name: fieldName,
        content: content,
        updated_by: user.id,
        is_active: true
      });

    if (insertError) {
      console.error('Error inserting new content:', insertError);
      throw insertError;
    }

    return true;
  } catch (error) {
    console.error(`Error updating admin content for ${pageName}.${fieldName}:`, error);
    throw error;
  }
}

/**
 * Check if current user is admin
 * @returns {Promise<boolean>} Whether user is admin
 */
export async function isUserAdmin() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from("profiles")
      .select("is_admin, role")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }

    return data?.is_admin === true || data?.role === "admin";
  } catch (error) {
    console.error('Error checking if user is admin:', error);
    return false;
  }
}

/**
 * Add OG badge to users who joined before Dec 31, 2025
 * @param {string} userId - User ID to check and update
 * @returns {Promise<boolean>} Whether badge was added
 */
export async function addOGBadgeIfEligible(userId) {
  try {
    const cutoffDate = new Date('2025-12-31T23:59:59Z');
    const now = new Date();
    
    // Check if we're before the cutoff date
    if (now > cutoffDate) {
      return false; // Too late for OG badge
    }

    // Check if user already has OG badge
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('badges')
      .eq('id', userId)
      .single();

    if (!existingProfile) {
      console.warn('User profile not found for OG badge check');
      return false;
    }

    const currentBadges = existingProfile.badges || [];
    if (currentBadges.includes('OG')) {
      return false; // Already has OG badge
    }

    // Add OG badge
    const newBadges = [...currentBadges, 'OG'];
    const { error } = await supabase
      .from('profiles')
      .update({ badges: newBadges })
      .eq('id', userId);

    if (error) {
      console.error('Error adding OG badge:', error);
      return false;
    }

    console.log(`✅ OG badge added to user ${userId}`);
    return true;
  } catch (error) {
    console.error('Error checking OG badge eligibility:', error);
    return false;
  }
}