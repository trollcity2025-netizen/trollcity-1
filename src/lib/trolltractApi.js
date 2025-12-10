// src/lib/trolltractApi.js
import { supabase } from "./supabase";

// TrollTract Contract Functions
export async function fetchMyTrolltractStatus() {
  const { data, error } = await supabase.rpc("get_my_trolltract_status");

  if (error) {
    console.error("Error fetching TrollTract status:", error);
    throw error;
  }

  return data;
}

export async function purchaseTrolltract() {
  const { data, error } = await supabase.rpc("purchase_trolltract");

  if (error) {
    console.error("Error purchasing TrollTract:", error);
    throw error;
  }

  // data is a text result: 'success' | 'already_contracted' | 'insufficient_funds'
  return data;
}

// Creator Application Functions
export async function submitCreatorApplication({
  experienceText,
  socialLinks = '',
  goalsText,
  empirePartnerRequest = false,
  empirePartnerReason = '',
  category = 'broadcaster'
}) {
  const { data, error } = await supabase.rpc("submit_creator_application", {
    p_experience_text: experienceText,
    p_social_links: socialLinks,
    p_goals_text: goalsText,
    p_empire_partner_request: empirePartnerRequest,
    p_empire_partner_reason: empirePartnerReason,
    p_category: category
  });

  if (error) {
    console.error("Error submitting creator application:", error);
    throw error;
  }

  return data;
}

export async function getUserApplicationStatus() {
  const { data, error } = await supabase.rpc("get_user_application_status");

  if (error) {
    console.error("Error fetching application status:", error);
    throw error;
  }

  return data;
}

export async function reviewCreatorApplication(applicationId, status, reviewerNotes = '') {
  const { data, error } = await supabase.rpc("review_creator_application", {
    p_application_id: applicationId,
    p_status: status,
    p_reviewer_notes: reviewerNotes
  });

  if (error) {
    console.error("Error reviewing application:", error);
    throw error;
  }

  return data;
}

export async function getAllCreatorApplications() {
  const { data, error } = await supabase.rpc("get_all_creator_applications");

  if (error) {
    console.error("Error fetching all applications:", error);
    throw error;
  }

  return data;
}

export async function userCanAccessCreatorFeatures(userId) {
  const { data, error } = await supabase.rpc("user_can_access_creator_features", {
    p_user_id: userId
  });

  if (error) {
    console.error("Error checking creator access:", error);
    throw error;
  }

  return data;
}