export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

export function handleCorsPreflight() {
  return new Response("ok", {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain",
      "Cache-Control": "max-age=0, s-maxage=0, no-cache, no-store, must-revalidate",
    },
  });
}

export function withCors(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
