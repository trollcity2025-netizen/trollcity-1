import { supabase } from './supabase'
import { AuthApiError } from '@supabase/supabase-js'
import { isPurchaseRequiredError, openPurchaseGate } from './purchaseGate'
import { trackEvent } from './telemetry'

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Use Supabase edge functions URL for proper API routing
const API_BASE_URL = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1';
// Centralized API endpoint definitions
export const API_ENDPOINTS = {
  auth: {
    fixAdminRole: '/auth/fix-admin-role',
    signup: '/auth/signup',
  },
  bank: {
    apply: '/bank-apply',
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
    token: '/livekit-token',   // Correct path for STREAM token
    api: '/livekit-api',
  },
  broadcastSeats: {
    list: '/broadcast-seats',
    action: '/broadcast-seats',
  },
  stream: {
    create: '/stream/create',
    prepare: '/go-live-prepare-session',
    markLive: '/go-live-mark-live',
    reset: '/go-live-reset',
    refundHDBoost: '/go-live-refund-hd-boost',
  },
  rtmp: {
    start: '/rtmp-relay',
  },
  admin: {
    trollDrop: '/admin/troll-drop',
    sendAnnouncement: '/send-announcement',
  },
  trollcourt: {
    ai: '/trollcourt-ai',
  },
  moderation: {
    submitReport: '/moderation',
    takeAction: '/moderation',
    listReports: '/moderation',
    shadowBan: '/shadow-ban-user',
    logEvent: '/log-moderation-event',
    giftFreeze: '/moderation', // Handled by take_action with type gift_freeze
    chatPurge: '/moderation', // Handled by take_action with type chat_purge
    disableStream: '/moderation', // Handled by take_action with type suspend_stream
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
    
    // Debug logging for signup endpoint
    if (endpoint.includes('/auth/signup')) {
      console.log(`[API ${requestId}] Signup request details:`, {
        endpoint,
        url,
        apiBaseUrl: API_BASE_URL,
        hasSupabaseAnonKey: !!supabaseAnonKey,
        supabaseAnonKeyLength: supabaseAnonKey?.length || 0
      });
    }

    // Add query parameters if present
    if (params) {
      const queryString = new URLSearchParams(
        Object.entries(params).map(([key, value]) => [key, String(value)])
      ).toString();
      url += `?${queryString}`;
    }

    // Supabase session token - always get fresh session
    let sessionData = await supabase.auth.getSession();
    let token = sessionData?.data?.session?.access_token;

    // If no token and this might be right after signup, wait and retry once
    if (!token) {
      await new Promise(resolve => setTimeout(resolve, 100));
      sessionData = await supabase.auth.getSession();
      token = sessionData?.data?.session?.access_token;
    }

    // Check if session is expired or about to expire (within 60 seconds)
    const expiresAt = sessionData?.data?.session?.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const sessionExpiringSoon = expiresAt && (expiresAt - now) < 60;


    // Enhanced logging for specific endpoints
    const isLiveKitEndpoint = endpoint.includes('livekit');
    const isBroadcastEndpoint = endpoint.includes('broadcast') || 
                               endpoint.includes('live-prepare') || 
                               endpoint.includes('live-mark') ||
                               endpoint.includes('refund-hd-boost') ||
                               endpoint.includes('announcement');

    if (isLiveKitEndpoint || isBroadcastEndpoint) {
      console.log(`[API ${requestId}] Session check:`, {
        hasSession: !!sessionData?.data?.session,
        hasToken: !!token,
        tokenLength: token?.length || 0,
        expiresAt,
        now,
        sessionExpiringSoon,
        endpoint
      });
    }

    // Don't require auth for signup endpoint (user doesn't exist yet)
    const isSignupEndpoint = endpoint.includes('/auth/signup');

    // For all endpoints (except signup), try to refresh session if no token or expiring soon
    if (((!token || sessionExpiringSoon) && !isSignupEndpoint)) {
      console.log(`[API ${requestId}] No token or session expiring for ${endpoint}, attempting session refresh...`);
      try {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError) {
          // Get the refreshed session
          sessionData = await supabase.auth.getSession();
          token = sessionData?.data?.session?.access_token;
          console.log(`[API ${requestId}] Session refreshed successfully`);
        } else {
          console.warn(`[API ${requestId}] Session refresh failed:`, refreshError.message);
        }
      } catch (refreshErr) {
        console.warn(`[API ${requestId}] Session refresh error:`, refreshErr);
      }
    }

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Always include anon key for Supabase Edge Functions
    if (supabaseAnonKey) {
      requestHeaders['apikey'] = supabaseAnonKey;
    }

    // For signup endpoint, use anon key as auth token since user doesn't exist yet
    // For other endpoints, add user auth token if available
    if (isSignupEndpoint) {
      requestHeaders['Authorization'] = `Bearer ${supabaseAnonKey}`;
    } else if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    if (isLiveKitEndpoint || isBroadcastEndpoint) {
      console.log(`[API ${requestId}] ${endpoint} headers:`, {
        hasApiKey: !!requestHeaders['apikey'],
        hasAuth: !!requestHeaders['Authorization'],
        authPrefix: requestHeaders['Authorization']?.substring(0, 30),
      });
    }

    // Add client info header
    requestHeaders['x-client-info'] = 'trollcity-web';

    // Merge any additional headers (these can override defaults)
    Object.assign(requestHeaders, headers);

    if (endpoint.includes('bank-apply')) {
      console.log(`[API ${requestId}] bank-apply headers:`, {
        hasApiKey: !!requestHeaders['apikey'],
        hasAuth: !!requestHeaders['Authorization'],
        authHeader: requestHeaders['Authorization']?.substring(0, 20) + '...',
        tokenAvailable: !!token,
        sessionExpiringSoon
      });
    }

    let response = await fetch(url, {
      ...fetchOptions,
      headers: requestHeaders,
    })

    // Retry logic for 401 Unauthorized
     if (response.status === 401 && !isSignupEndpoint) {
       console.log(`[API ${requestId}] 401 Unauthorized. Attempting token refresh and retry...`);
       try {
         // Add timeout to prevent hanging indefinitely
         // Increased timeout to 15s to accommodate slower connections
         const refreshPromise = supabase.auth.refreshSession();
         const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Refresh timeout')), 15000));
         
         // Check if we already have a new token in memory that differs from the one we sent
         const currentSession = await supabase.auth.getSession();
         const currentToken = currentSession?.data?.session?.access_token;
         
         let newToken: string | undefined = undefined;
         
         if (currentToken && currentToken !== token) {
            console.log(`[API ${requestId}] Found fresh token in memory, using it.`);
            newToken = currentToken;
         } else {
             // Wait for refresh or timeout
             const result: any = await Promise.race([refreshPromise, timeoutPromise]);
             const { error: refreshError } = result;

             if (!refreshError) {
               const sessionData = await supabase.auth.getSession();
               newToken = sessionData?.data?.session?.access_token;
             } else {
               console.warn(`[API ${requestId}] Token refresh failed during retry:`, refreshError.message);
               // If refresh explicitly fails, we can't retry.
               // We should probably let the 401 propagate so the UI handles it, or trigger logout if it's a fatal auth error.
             }
         }

         if (newToken) {
           requestHeaders['Authorization'] = `Bearer ${newToken}`;
           
           // Also timeout the retry fetch
           const fetchPromise = fetch(url, {
             ...fetchOptions,
             headers: requestHeaders,
           });
           const fetchTimeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Retry fetch timeout')), 15000));
           
           response = await Promise.race([fetchPromise, fetchTimeoutPromise]) as Response;
           console.log(`[API ${requestId}] Retry successful (status: ${response.status})`);
         }
       } catch (retryErr: any) {
         console.error(`[API ${requestId}] Error during retry:`, retryErr);
         // If we timed out or failed to refresh, we should consider if we need to force logout
         if (retryErr.message === 'Refresh timeout' || retryErr.message === 'Retry fetch timeout') {
            console.warn(`[API ${requestId}] Retry timed out. Session may be dead.`);
            // Don't force logout immediately on timeout, as it might be temporary network issue.
            // But we should definitely fail this request gracefully.
         }
       }
     }

    const contentType = response.headers.get('content-type');
    let data: any;

    try {
      data = contentType?.includes('application/json')
        ? await response.json()
        : await response.text();
    } catch (parseError: any) {
      console.error(`[API ${requestId}] Failed to parse response:`, parseError)
      throw new Error(`Failed to parse response: ${parseError.message}`)
    }

    if (response.ok) {
      return { success: true, ...data }
    } else {
      const errorMsg = data?.error || data?.message || `API Error: ${response.status} ${response.statusText}`

      if (!endpoint.includes('telemetry')) {
        trackEvent({
          event_type: 'api_error',
          message: errorMsg,
          severity: response.status >= 500 ? 'error' : 'warning',
          fingerprint: `api-${response.status}-${endpoint}`,
          request_info: {
            endpoint,
            status: response.status,
            requestId,
            duration: Date.now() - Number(requestId.split('_')[1])
          }
        });
      }

      if (isPurchaseRequiredError(data) || isPurchaseRequiredError(errorMsg)) {
        openPurchaseGate(data?.error || data?.message || errorMsg)
      }

      if (isLiveKitEndpoint || isBroadcastEndpoint) {
        console.error(`[API ${requestId}] ❌ Request failed:`, {
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

    console.error(`[API ${requestId}] ❌ Network/Request Error:`, errorDetails)

    if (!endpoint.includes('telemetry')) {
      trackEvent({
        event_type: 'api_network_error',
        message: errorDetails.message,
        stack: errorDetails.stack,
        severity: 'error',
        fingerprint: `api-net-${endpoint}`,
        request_info: {
          endpoint,
          requestId,
          duration: Date.now() - Number(requestId.split('_')[1])
        }
      });
    }

    // Handle Supabase AuthApiError (invalid refresh token)
    if (error instanceof AuthApiError) {
      console.error(`[Auth Error ${requestId}] AuthApiError detected:`, error.message)
      if (error.message.includes('Invalid Refresh Token') || error.message.includes('Refresh Token Not Found')) {
        console.log(`[Auth Error ${requestId}] Invalid refresh token - logging out user`)
        // Import the store dynamically to avoid circular imports
        import('./store').then(({ useAuthStore }) => {
          return useAuthStore.getState().logout()
        }).then(() => {
          console.log('Logout completed successfully')
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

    // Provide more helpful error message
    let errorMessage = error instanceof Error ? error.message : 'Network error occurred'
    if (error instanceof TypeError && error.message.includes('fetch')) {
      const fullUrl = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
      errorMessage = `Failed to connect to server. Please check:
1. Edge function is deployed
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
