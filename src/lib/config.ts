// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const API_ENDPOINTS = {
  auth: {
    fixAdminRole: `${API_URL}/api/auth/fix-admin-role`,
  },
  payments: {
    status: `${API_URL}/api/payments/status`,
  },
  agora: {
    token: `${API_URL}/api/agora-token`,
  },
  admin: {
    trollDrop: `${API_URL}/api/admin/troll-drop`,
  },
}
