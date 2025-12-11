import { ROLE_PERMISSIONS } from './roles'

/**
 * Normalize role string to ensure consistency
 */
export function normalizeRole(role) {
  if (!role) return 'guest'

  // Handle different role formats
  const roleMap = {
    'admin': 'admin',
    'administrator': 'admin',
    'lead_troll_officer': 'lead_troll_officer',
    'lead-officer': 'lead_troll_officer',
    'troll_officer': 'troll_officer',
    'officer': 'troll_officer',
    'broadcaster': 'broadcaster',
    'creator': 'broadcaster',
    'empire_partner': 'empire_partner',
    'partner': 'empire_partner',
    'troller': 'troller',
    'user': 'troller',
    'guest': 'guest',
    'visitor': 'guest'
  }

  return roleMap[role.toLowerCase()] || 'guest'
}

/**
 * Check if a role has access to a specific page
 */
export function hasAccess(role, pageId) {
  const normalizedRole = normalizeRole(role)

  // Admin has access to everything
  if (normalizedRole === 'admin') return true

  // Check role permissions
  const rolePerms = ROLE_PERMISSIONS[normalizedRole]
  if (!rolePerms) return false

  return rolePerms.pages.includes(pageId)
}

/**
 * Check if a role can perform a specific action
 */
export function canDo(role, actionId) {
  const normalizedRole = normalizeRole(role)

  // Admin can do everything
  if (normalizedRole === 'admin') return true

  // Check role permissions
  const rolePerms = ROLE_PERMISSIONS[normalizedRole]
  if (!rolePerms) return false

  return rolePerms.actions.includes(actionId)
}

/**
 * Check if role A outranks role B in the hierarchy
 */
export function outranks(roleA, roleB) {
  const hierarchy = {
    'admin': 100,
    'lead_troll_officer': 80,
    'troll_officer': 60,
    'broadcaster': 40,
    'empire_partner': 40,
    'troller': 20,
    'guest': 10
  }

  const normalizedA = normalizeRole(roleA)
  const normalizedB = normalizeRole(roleB)

  return hierarchy[normalizedA] > hierarchy[normalizedB]
}

/**
 * Get all accessible pages for a role
 */
export function getAccessiblePages(role) {
  const normalizedRole = normalizeRole(role)

  if (normalizedRole === 'admin') {
    // Admin gets all pages
    return Object.values(ROLE_PERMISSIONS).flatMap(perms => perms.pages)
  }

  const rolePerms = ROLE_PERMISSIONS[normalizedRole]
  return rolePerms ? rolePerms.pages : []
}

/**
 * Get all allowed actions for a role
 */
export function getAllowedActions(role) {
  const normalizedRole = normalizeRole(role)

  if (normalizedRole === 'admin') {
    // Admin gets all actions
    return Object.values(ROLE_PERMISSIONS).flatMap(perms => perms.actions)
  }

  const rolePerms = ROLE_PERMISSIONS[normalizedRole]
  return rolePerms ? rolePerms.actions : []
}