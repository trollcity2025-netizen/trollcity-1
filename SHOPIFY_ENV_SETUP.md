# Shopify Partner Program Environment Variables

## Vercel + Supabase Edge Functions

Set these in your Vercel environment variables and Supabase Edge function config:

### Shopify App Settings (from Shopify Partner dashboard):
- `SHOPIFY_API_KEY` - Your public app key
- `SHOPIFY_API_SECRET` - Your private app secret
- `SHOPIFY_SCOPES` - Comma-separated scopes (e.g., "read_orders,read_products")
- `SHOPIFY_APP_URL` - Your app's main URL (e.g., https://maitrollcity.com)
- `SHOPIFY_OAUTH_CALLBACK_URL` - Supabase function URL (e.g., https://YOUR-SUPABASE-FUNCTION-DOMAIN/functions/v1/shopify-oauth-callback)
- `SHOPIFY_WEBHOOK_SECRET` - Random secret for HMAC verification

### Platform Settings:
- `TROLL_PLATFORM_DEFAULT_CUT` - Default platform cut percentage (e.g., "12.5")

### Supabase Settings:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for Edge functions

## Frontend (Vite) Environment Variables

Add to your `.env` file:

```
VITE_SHOPIFY_API_KEY=your_public_key
VITE_SHOPIFY_SCOPES=read_orders
VITE_SHOPIFY_OAUTH_CALLBACK_URL=https://YOUR-SUPABASE-FUNCTION-DOMAIN/functions/v1/shopify-oauth-callback
```

## Local Development

For local dev, use the same keys in your local `.env` and Supabase functions config.

## Deployment Steps

1. Set all environment variables in Vercel
2. Set environment variables in Supabase Edge functions
3. Deploy functions:
   ```
   supabase functions deploy shopify-oauth-callback
   supabase functions deploy shopify-webhook
   ```
4. Run the SQL migration in Supabase SQL editor: `shopify_tables_and_policies.sql`