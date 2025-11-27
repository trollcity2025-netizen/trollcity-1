/**
 * API Helper for Supabase Edge Functions
 * 
 * Automatically reads VITE_EDGE_FUNCTIONS_URL from environment variables
 * and provides a clean interface for making API calls.
 * 
 * Works both on localhost and production (Vercel).
 */

const API_BASE_URL = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'

interface ApiResponse<T = any> {
  data?: T
  error?: string
  success?: boolean
  [key: string]: any
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>
}

/**
 * Makes a fetch request to a Supabase Edge Function
 * 
 * @param endpoint - The function endpoint (e.g., '/clever-api')
 * @param options - Fetch options including params, body, headers, etc.
 * @returns Promise with the API response
 */
async function request<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  try {
    const { params, headers, ...fetchOptions } = options

    // Build URL with query parameters if provided
    let url = `${API_BASE_URL}${endpoint}`
    if (params) {
      const queryString = new URLSearchParams(
        Object.entries(params).map(([key, value]) => [key, String(value)])
      ).toString()
      url += `?${queryString}`
    }

    // Make the request with automatic JSON headers
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    })

    // Parse response
    const contentType = response.headers.get('content-type')
    let data: any

    if (contentType?.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    // Handle error responses
    if (!response.ok) {
      return {
        success: false,
        error: data?.error || data?.message || `API Error: ${response.status} ${response.statusText}`,
        ...data,
      }
    }

    // Return successful response
    return {
      success: true,
      ...data,
    }
  } catch (error) {
    // Handle network errors
    console.error('API Request Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred',
    }
  }
}

/**
 * Makes a GET request to a Supabase Edge Function
 * 
 * @param endpoint - The function endpoint
 * @param params - Optional query parameters
 * @param options - Additional fetch options
 * @returns Promise with the API response
 */
export async function get<T = any>(
  endpoint: string,
  params?: Record<string, string | number | boolean>,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    ...options,
    method: 'GET',
    params,
  })
}

/**
 * Makes a POST request to a Supabase Edge Function
 * 
 * @param endpoint - The function endpoint
 * @param body - Request body (will be JSON stringified)
 * @param options - Additional fetch options
 * @returns Promise with the API response
 * 
 * @example
 * const res = await api.post('/clever-api', { message: 'hello' })
 */
export async function post<T = any>(
  endpoint: string,
  body?: any,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * Makes a PUT request to a Supabase Edge Function
 * 
 * @param endpoint - The function endpoint
 * @param body - Request body (will be JSON stringified)
 * @param options - Additional fetch options
 * @returns Promise with the API response
 */
export async function put<T = any>(
  endpoint: string,
  body?: any,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * Makes a PATCH request to a Supabase Edge Function
 * 
 * @param endpoint - The function endpoint
 * @param body - Request body (will be JSON stringified)
 * @param options - Additional fetch options
 * @returns Promise with the API response
 */
export async function patch<T = any>(
  endpoint: string,
  body?: any,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * Makes a DELETE request to a Supabase Edge Function
 * 
 * @param endpoint - The function endpoint
 * @param params - Optional query parameters
 * @param options - Additional fetch options
 * @returns Promise with the API response
 */
export async function del<T = any>(
  endpoint: string,
  params?: Record<string, string | number | boolean>,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    ...options,
    method: 'DELETE',
    params,
  })
}

// Default export with all methods
const api = {
  get,
  post,
  put,
  patch,
  delete: del,
  request,
}

export default api
