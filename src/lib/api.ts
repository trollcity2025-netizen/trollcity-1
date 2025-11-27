import { supabase } from './supabase'

// Normalize base URL, remove trailing slash if needed
const API_BASE_URL = import.meta.env.VITE_EDGE_FUNCTIONS_URL?.replace(/\/$/, '') 
  || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1';
// Centralized API endpoint definitions
export const API_ENDPOINTS = {
  auth: {
    fixAdminRole: '/auth/fix-admin-role',
  },
  payments: {
    status: '/payments/status',
  },
  agora: {
    token: '/admin/agora-token',   // 👈 Correct path for STREAM token
  },
  stream: {
    create: '/stream/create',      // 👈 You’ll use this soon
  },
  admin: {
    trollDrop: '/admin/troll-drop',
  },
};

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success?: boolean;
  [key: string]: any;
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

async function request<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  try {
    const { params, headers, ...fetchOptions } = options;

    // Always ensure endpoint begins with a single slash
    let url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    // Add query parameters if present
    if (params) {
      const queryString = new URLSearchParams(
        Object.entries(params).map(([key, value]) => [key, String(value)])
      ).toString();
      url += `?${queryString}`;
    }

    // Supabase session token
    const { data: sessionData } = await supabase.auth.getSession();
    const token =
      sessionData?.session?.access_token ||
      (typeof window !== 'undefined' ? localStorage.getItem('sb-access-token') || '' : '');

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });

    const contentType = response.headers.get('content-type');
    const data = contentType?.includes('application/json')
      ? await response.json()
      : await response.text();

    return response.ok
      ? { success: true, ...data }
      : {
          success: false,
          error: data?.error || data?.message || `API Error: ${response.status} ${response.statusText}`,
          ...data,
        };
  } catch (error) {
    console.error('API Request Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred',
    };
  }
}

export async function get<T = any>(endpoint: string, params?: any, options?: RequestOptions) {
  return request<T>(endpoint, { ...options, method: 'GET', params });
}

export async function post<T = any>(endpoint: string, body?: any, options?: RequestOptions) {
  return request<T>(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) });
}

export async function put<T = any>(endpoint: string, body?: any, options?: RequestOptions) {
  return request<T>(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) });
}

export async function patch<T = any>(endpoint: string, body?: any, options?: RequestOptions) {
  return request<T>(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) });
}

export async function del<T = any>(endpoint: string, params?: any, options?: RequestOptions) {
  return request<T>(endpoint, { ...options, method: 'DELETE', params });
}

const api = { get, post, put, patch, delete: del, request };

export default api;
