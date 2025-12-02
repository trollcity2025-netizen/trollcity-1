export const config = { runtime: "edge" };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  return new Response(
    JSON.stringify({ ok: true, timestamp: Date.now() }),
    { headers: { ...cors, "Content-Type": "application/json" } }
  );
}

