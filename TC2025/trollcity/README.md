# Troll CityS


This app was created automatically by Troll City LLC.
It's a Vite+React app that communicates with the SupabaseS API.

## Environment

This app integrates with Supabase. Set the following environment variables:

- `VITE_SUPABASE_URL` — your Supabase project URL (e.g., `https://<ref>.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` — your Supabase anon public key
- `VITE_SUPABASE_FUNCTIONS_URL` — optional; functions host (defaults to `<ref>.functions.supabase.co`)

See `.env.example` for a template. Do not commit real keys.

### Vercel setup

- In Project Settings → Environment Variables, add the variables above for Production and Preview.
- Redeploy after changes. If needed, trigger “Redeploy with cache disabled”.

### Local development

- Create `.env.local` in the project root using `.env.example`.
- Keys in `.env.local` are git-ignored by default.

## Running the app

```bash
npm install
npm run dev
```

## Building the app

```bash
npm run build
```

For more information and support, please contact supabase support at app@supabase.com.
