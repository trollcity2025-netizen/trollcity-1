// src/utils/shopifyAuth.js
export function createShopifyAuthUrl({ shop, userId }) {
  const params = new URLSearchParams();
  params.set("client_id", import.meta.env.VITE_SHOPIFY_API_KEY);
  params.set(
    "scope",
    import.meta.env.VITE_SHOPIFY_SCOPES || "read_orders"
  );
  params.set(
    "redirect_uri",
    import.meta.env.VITE_SHOPIFY_OAUTH_CALLBACK_URL
  );

  // Encode state with user_id
  const statePayload = { user_id: userId };
  const state = btoa(JSON.stringify(statePayload));
  params.set("state", state);

  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}