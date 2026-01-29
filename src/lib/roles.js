/**
 * Role-based permissions configuration
 * Defines what pages and actions each role can access
 */
export const ROLE_PERMISSIONS = {
  admin: {
    pages: [
      // All pages
      'home', 'messages', 'following', 'store', 'marketplace', 'inventory', 'sell',
      'leaderboard', 'wall', 'tromody', 'troll-court', 'empire-partner',
      'apply', 'support', 'safety', 'officer-lounge', 'officer-moderation', 'family',
      'rfc', 'admin-earnings', 'admin', 'admin-applications', 'admin-marketplace',
      'admin-officer-reports', 'store-debug', 'changelog', 'lead-officer'
    ],
    actions: [
      // All actions
      'create_stream', 'moderate', 'ban_users', 'manage_economy', 'view_analytics',
      'manage_applications', 'send_notifications', 'manage_marketplace', 'debug_tools'
    ]
  },

  lead_troll_officer: {
    pages: [
      'home', 'messages', 'following', 'store', 'marketplace', 'inventory', 'sell',
      'leaderboard', 'wall', 'tromody', 'troll-court', 'empire-partner',
      'apply', 'support', 'safety', 'officer-lounge', 'officer-moderation', 'family',
      'lead-officer'
    ],
    actions: [
      'create_stream', 'moderate', 'ban_users', 'manage_applications', 'send_notifications'
    ]
  },

  troll_officer: {
    pages: [
      'home', 'tcps', 'following', 'store', 'marketplace', 'inventory', 'sell',
      'leaderboard', 'wall', 'tromody', 'troll-court', 'empire-partner',
      'apply', 'support', 'safety', 'officer-lounge', 'officer-moderation', 'family'
    ],
    actions: [
      'create_stream', 'moderate', 'ban_users'
    ]
  },

  broadcaster: {
    pages: [
      'home', 'messages', 'following', 'store', 'marketplace', 'inventory', 'sell',
      'leaderboard', 'wall', 'tromody', 'troll-court', 'empire-partner',
      'apply', 'support', 'safety'
    ],
    actions: [
      'create_stream', 'send_gifts'
    ]
  },

  empire_partner: {
    pages: [
      'home', 'messages', 'following', 'store', 'marketplace', 'inventory', 'sell',
      'leaderboard', 'wall', 'tromody', 'troll-court', 'empire-partner',
      'apply', 'support', 'safety'
    ],
    actions: [
      'create_stream', 'send_gifts', 'partner_features'
    ]
  },

  troller: {
    pages: [
      'home', 'messages', 'following', 'store', 'marketplace', 'inventory', 'sell',
      'leaderboard', 'wall', 'tromody', 'troll-court', 'empire-partner',
      'apply', 'support', 'safety'
    ],
    actions: [
      'send_gifts', 'participate'
    ]
  },

  guest: {
    pages: [
      'home', 'store', 'leaderboard', 'support', 'safety'
    ],
    actions: [
      'view_public'
    ]
  }
}