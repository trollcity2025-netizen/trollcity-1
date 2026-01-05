export const EDGE_URL = import.meta.env.VITE_EDGE_FUNCTIONS_URL

export const API_ENDPOINTS = {
  auth: {
    fixAdminRole: `${EDGE_URL}/auth/fix-admin-role`,
  },
  payments: {
    status: `${EDGE_URL}/payments-status`,
  },
  agora: {
    token: `${EDGE_URL}/admin/agora-token`,
  },
  livekit: {
    token: `${EDGE_URL}/livekit-token`,
  },
  admin: {
    trollDrop: `${EDGE_URL}/admin/troll-drop`,
  },
}
