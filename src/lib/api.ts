import { supabase } from '../supabaseClient'
import { AuthApiError } from '@supabase/supabase-js'

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Normalize base URL, remove trailing slash if needed
const API_BASE_URL = import.meta.env.VITE_EDGE_FUNCTIONS_URL?.replace(/\/$/, '') 
  || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1';
// Centralized API endpoint definitions
export const API_ENDPOINTS = {
  auth: {
    fixAdminRole: '/auth/fix-admin-role',
  },
  payments: {
    status: '/payments-status',
  },
  referrals: {
    processBonuses: '/process-referral-bonuses',
  },
  square: {
    createCheckout: '/create-square-checkout',
    verifyPayment: '/verify-square-payment',
    createCustomer: '/create-square-customer',
    addCard: '/add-card',
    saveCard: '/payments',
    chargeCard: '/charge-stored-card',
  },
  livekit: {
    token: '/livekit-token',   // 👈 Correct path for STREAM token
  },
  broadcastSeats: {
    list: '/broadcast-seats',
    action: '/broadcast-seats',
  },
  stream: {
    create: '/stream/create',      // 👈 You’ll use this soon
  },
  rtmp: {
    start: '/rtmp-relay',
  },
  admin: {
    trollDrop: '/admin/troll-drop',
  },
  moderation: {
    submitReport: '/moderation',
    takeAction: '/moderation',
    listReports: '/moderation',
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
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
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

    // Supabase session token - always get fresh session
    // If session is not immediately available, wait a bit and retry (for signup flow)
    let sessionData = await supabase.auth.getSession();
    let token = sessionData?.data?.session?.access_token;
    
    if (endpoint.includes('broadcast')) {
      console.log(`[API ${requestId}] Session check (before retry):`, {
        hasSession: !!sessionData?.data?.session,
        hasToken: !!token,
        tokenLength: token?.length || 0,
      });
    }
    
    // If no token and this might be right after signup, wait and retry once
    if (!token) {
      await new Promise(resolve => setTimeout(resolve, 100));
      sessionData = await supabase.auth.getSession();
      token = sessionData?.data?.session?.access_token;
      
      if (endpoint.includes('broadcast')) {
        console.log(`[API ${requestId}] Session check (after retry):`, {
          hasSession: !!sessionData?.data?.session,
          hasToken: !!token,
          tokenLength: token?.length || 0,
        });
      }
    }
    
    const sessionError = sessionData?.error;
    
    // Enhanced logging for Square endpoints and wheel
    const isSquareEndpoint = endpoint.includes('square') || endpoint.includes('payments') || endpoint.includes('add-card') || endpoint.includes('charge-stored-card') || endpoint.includes('create-square')
    const isWheelEndpoint = endpoint.includes('wheel')
    
    if (!token && (isSquareEndpoint || isWheelEndpoint)) {
      console.warn(`[API ${requestId}] No access token available for authenticated endpoint: ${endpoint}`);
    }
    if (isSquareEndpoint) {
      console.log(`[Square Debug ${requestId}] Starting request:`, {
        endpoint,
        url,
        method: fetchOptions.method || 'GET',
        hasToken: !!token,
        tokenLength: token?.length || 0,
        apiBaseUrl: API_BASE_URL,
        sessionError: sessionError?.message,
      })
    }

    // Don't require auth for signup endpoint (user doesn't exist yet)
    const isSignupEndpoint = endpoint.includes('/auth/signup');

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Always include anon key for Supabase Edge Functions
    if (supabaseAnonKey) {
      requestHeaders['apikey'] = supabaseAnonKey;
    }

    // For signup endpoint, use anon key as auth token since user doesn't exist yet
    // For LiveKit token, don't send auth (public endpoint)
    // For other endpoints, add user auth token if available
    if (isSignupEndpoint) {
      requestHeaders['Authorization'] = `Bearer ${supabaseAnonKey}`;
    } else if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    } else if (endpoint.includes('broadcast')) {
      // For broadcast-seats, if no token, we have a problem - log it
      console.warn(`[API ${requestId}] NO TOKEN for broadcast-seats endpoint`, {
        endpoint,
        hasToken: !!token,
        sessionError: sessionError?.message,
      });
    }
    
    if (endpoint.includes('broadcast')) {
      console.log(`[API ${requestId}] broadcast-seats headers:`, {
        hasApiKey: !!requestHeaders['apikey'],
        hasAuth: !!requestHeaders['Authorization'],
        authPrefix: requestHeaders['Authorization']?.substring(0, 30),
      });
    }
    
    // Add client info header
    requestHeaders['x-client-info'] = 'trollcity-web';
    
    // Merge any additional headers (these can override defaults)
    Object.assign(requestHeaders, headers);

    // Log token status for debugging (wheel and square endpoints)
    if (isSquareEndpoint || isWheelEndpoint) {
      console.log(`[API ${requestId}] Token status:`, {
        hasToken: !!token,
        tokenLength: token?.length || 0,
        tokenPreview: token ? `${token.substring(0, 20)}...` : 'none',
        endpoint,
        sessionError: sessionError?.message
      });
    }

    if (isSquareEndpoint) {
      console.log(`[Square Debug ${requestId}] Request headers:`, {
        hasAuth: !!requestHeaders.Authorization,
        contentType: requestHeaders['Content-Type'],
        customHeaders: Object.keys(headers || {}),
      })
    }

    // For Square/payments endpoints, add extra logging
    if (isSquareEndpoint) {
      console.log(`[Square Debug ${requestId}] Making fetch request:`, {
        url,
        method: fetchOptions.method || 'GET',
        headers: {
          ...requestHeaders,
          Authorization: requestHeaders.Authorization ? `${requestHeaders.Authorization.substring(0, 20)}...` : 'none',
        },
      })
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers: requestHeaders,
    })
    
    if (isSquareEndpoint) {
      console.log(`[Square Debug ${requestId}] Response received:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      })
    };

    if (isSquareEndpoint) {
      console.log(`[Square Debug ${requestId}] Response received:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        url: response.url,
      })
    }

    const contentType = response.headers.get('content-type');
    let data: any;
    
    try {
      data = contentType?.includes('application/json')
        ? await response.json()
        : await response.text();
      
      if (isSquareEndpoint) {
        console.log(`[Square Debug ${requestId}] Response data:`, {
          type: typeof data,
          isString: typeof data === 'string',
          preview: typeof data === 'string' ? data.substring(0, 200) : JSON.stringify(data).substring(0, 200),
        })
      }
    } catch (parseError: any) {
      console.error(`[Square Debug ${requestId}] Failed to parse response:`, parseError)
      throw new Error(`Failed to parse response: ${parseError.message}`)
    }

    if (response.ok) {
      if (isSquareEndpoint) {
        console.log(`[Square Debug ${requestId}] ✅ Request successful`)
      }
      return { success: true, ...data }
    } else {
      const errorMsg = data?.error || data?.message || `API Error: ${response.status} ${response.statusText}`
      if (isSquareEndpoint) {
        console.error(`[Square Debug ${requestId}] ❌ Request failed:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorMsg,
          data,
        })
      }
      return {
        success: false,
        error: errorMsg,
        ...data,
      };
    }
  } catch (error) {
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Error',
      stack: error instanceof Error ? error.stack : undefined,
      endpoint,
      url: `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`,
      apiBaseUrl: API_BASE_URL,
    }

    console.error(`[Square Debug ${requestId}] ❌ Network/Request Error:`, errorDetails)

    // Handle Supabase AuthApiError (invalid refresh token)
    if (error instanceof AuthApiError) {
      console.error(`[Auth Error ${requestId}] AuthApiError detected:`, error.message)
      if (error.message.includes('Invalid Refresh Token') || error.message.includes('Refresh Token Not Found')) {
        console.log(`[Auth Error ${requestId}] Invalid refresh token - logging out user`)
        // Import the store dynamically to avoid circular imports
        import('./store').then(({ useAuthStore }) => {
          useAuthStore.getState().logout()
        }).catch(storeError => {
          console.error('Failed to import store for logout:', storeError)
          // Fallback: clear local storage and reload
          localStorage.removeItem('troll-city-auth')
          window.location.href = '/auth'
        })
        return {
          success: false,
          error: 'Your session has expired. Please sign in again.',
          debug: {
            requestId,
            ...errorDetails,
          },
        };
      }
    }

    // Check for specific error types
    if (error instanceof TypeError && error.message.includes('fetch')) {
      const fullUrl = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
      console.error(`[Square Debug ${requestId}] Fetch error details:`, {
        isNetworkError: true,
        possibleCauses: [
          'CORS issue - Check edge function CORS headers',
          'Network connectivity problem',
          'Edge function not deployed - Run: npx supabase functions deploy add-card',
          'Incorrect API_BASE_URL - Current:', API_BASE_URL,
          'SSL/TLS certificate issue',
          'Edge function URL incorrect - Full URL:', fullUrl
        ],
        apiBaseUrl: API_BASE_URL,
        endpoint,
        fullUrl,
        envVar: import.meta.env.VITE_EDGE_FUNCTIONS_URL || 'NOT SET',
      })
    }

    // Provide more helpful error message
    let errorMessage = error instanceof Error ? error.message : 'Network error occurred'
    if (error instanceof TypeError && error.message.includes('fetch')) {
      const fullUrl = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
      errorMessage = `Failed to connect to server. Please check:
1. Edge function is deployed: npx supabase functions deploy add-card
2. VITE_EDGE_FUNCTIONS_URL is set correctly
3. Your internet connection is working

URL: ${fullUrl}`
    }

    return {
      success: false,
      error: errorMessage,
      debug: {
        requestId,
        ...errorDetails,
      },
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

export async function createMuxStream() {
  return await post('/mux-create-stream')
}

export async function startRtmpRelay(roomName: string, streamKey: string) {
  return await post(API_ENDPOINTS.rtmp.start, { roomName, streamKey })
}

const api = { get, post, put, patch, delete: del, request, createMuxStream, startRtmpRelay };

export default api;
