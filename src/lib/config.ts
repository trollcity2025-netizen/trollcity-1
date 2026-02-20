export const EDGE_URL = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'

export const API_ENDPOINTS = {
  auth: {
    fixAdminRole: `${EDGE_URL}/auth/fix-admin-role`,
  },
  payments: {
    status: `${EDGE_URL}/payments-status`,
  },

  admin: {
    trollDrop: `${EDGE_URL}/admin/troll-drop`,
  },
}
