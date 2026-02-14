
// For Deno/Vercel Edge Functions, we can't use process.env directly
// The VERCEL_URL is injected by Vercel's runtime
const getVercelUrl = (): string => {
  try {
    // @ts-expect-error - VERCEL_URL is injected by Vercel
    return typeof VERCEL_URL !== 'undefined' ? `https://${VERCEL_URL}` : '';
  } catch {
    return '';
  }
};

const getVercelBranchUrl = (): string => {
  try {
    // @ts-expect-error - VERCEL_BRANCH_URL is injected by Vercel
    return typeof VERCEL_BRANCH_URL !== 'undefined' ? `https://${VERCEL_BRANCH_URL}` : '';
  } catch {
    return '';
  }
};

const allowedOrigins = [
  'http://localhost:5176',
  'http://localhost:5177',
  'http://localhost:3001',
  'http://localhost:3000',
  'https://maitrollcity.com',
  'https://www.maitrollcity.com',
  'https://troll-city.vercel.app',
  getVercelUrl(),
  getVercelBranchUrl()
].filter((origin): origin is string => Boolean(origin));

// Default CORS headers with wildcard origin
const defaultCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin, content-length',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, PATCH',
  'Vary': 'Origin'
};

// Dynamic CORS headers based on origin
export function corsHeaders(origin?: string | null): Record<string, string> {
  if (!origin) {
    return defaultCorsHeaders;
  }
  
  const isAllowed = allowedOrigins.includes(origin);
  const validOrigin = isAllowed ? origin : '*';
  
  const headers = {
    ...defaultCorsHeaders,
    'Access-Control-Allow-Origin': validOrigin,
  };

  // If we are using a specific origin (not wildcard), we can allow credentials
  if (isAllowed) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

export function handleCorsPreflight() {
  return new Response("ok", {
    status: 200,
    headers: {
      ...corsHeaders(),
      "Content-Type": "text/plain",
      "Cache-Control": "max-age=0, s-maxage=0, no-cache, no-store, must-revalidate",
    },
  });
}

export function withCors(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
