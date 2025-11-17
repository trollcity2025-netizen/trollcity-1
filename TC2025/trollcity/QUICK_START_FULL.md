# 🚀 Quick Start — Full automated setup & test (PowerShell)

This quick-start will walk you through everything you need to do locally to deploy and smoke-test the new Troll City features (database migration, function deployment, image placement, dev server, and smoke tests).

Estimated total time: ~30–45 minutes.

Important: run these commands from the project root: `C:\Apps\trollcity` (PowerShell). Replace `YOUR_PROJECT` with your Supabase project ref when needed.

---

## 1) Prerequisites

- Node.js (16+), npm installed
- Supabase CLI installed and logged in (supabase login)
- Your Supabase project configured (ENV vars or `supabase` configured locally)
- You have your uploaded MAI image on your machine (from attachments). We'll copy it to `public/mai_trollcity.jpeg`.

If you need to install the Supabase CLI:

```powershell
# Install supabase cli via npm (if needed)
npm install -g supabase
```

---

## 2) Place the hero image (I can't move your local file for you)

Copy the provided image into the `public` folder and name it `mai_trollcity.jpeg`.

PowerShell (run from project root):

```powershell
# adjust the source path if different
Copy-Item -Path "C:\Users\justk\Downloads\Screenshot_6-8-2025_184649_looka.com.jpeg" -Destination .\public\mai_trollcity.jpeg -Force
# or move it
Move-Item -Path "C:\Users\justk\Downloads\Screenshot_6-8-2025_184649_looka.com.jpeg" -Destination .\public\mai_trollcity.jpeg
```

After copying, confirm the file exists:

```powershell
Test-Path .\public\mai_trollcity.jpeg
# returns True if present
```

If you prefer a different filename, update the `src` in `src/pages/Home.jsx` accordingly.

---

## 3) Apply the database migration (supabase)

This will create the new tables and add profile columns.

PowerShell:

```powershell
cd C:\Apps\trollcity
# ensure you're authenticated with supabase
supabase db push
```

If this fails, check your Supabase connection (SERVICE_ROLE key or CLI auth) and re-run. See `SETUP_GAMBLING_GIFTS_FEATURES.md` for troubleshooting.

---

## 4) Deploy the Edge Function (randomCoinGiveaway)

PowerShell:

```powershell
# From project root
supabase functions deploy randomCoinGiveaway
# Optional: invoke to test immediately
supabase functions invoke randomCoinGiveaway --log
```

If invocation returns winners and total_distributed, it's working.

---

## 5) Schedule the giveaway

Pick one option (recommended: Supabase Scheduled Functions)

Option A — Supabase (dashboard):
- Open Supabase → Edge Functions → randomCoinGiveaway → Add schedule
- Use cron: `0 12 * * 0` (weekly) or your preferred cron

Option B — External cron (if you prefer):
- Use EasyCron or EventBridge. POST to:
  `https://<YOUR_PROJECT>.functions.supabase.co/randomCoinGiveaway`

Option C — Self-hosted:

```javascript
// node cron snippet
const cron = require('node-cron');
const fetch = require('node-fetch');
cron.schedule('0 12 * * 0', async () => {
  await fetch('https://<YOUR_PROJECT>.functions.supabase.co/randomCoinGiveaway', { method: 'POST' });
});
```

---

## 6) Install dependencies & start dev server

PowerShell:

```powershell
# If not done already
npm install
# Start dev server (vite or npm script in package.json)
npm run dev
# or sometimes
# npm run start
```

Open the dev URL reported by the server (commonly http://localhost:5173 or http://localhost:3000).

---

## 7) Smoke tests (follow in-browser)

Open the site and validate these quickly:

1. Home page
   - Hero displays the MAI image and headline "MAI Introduces Troll City".
   - Log In button goes to `/Login`.
   - Footer shows © <year> MAI Corporation and links to Employment and Contact Us.

2. Employment page
   - Visit `/Employment` — shows positions and contact email `trollcity2025@gmail.com`.

3. Contact Us page
   - Visit `/ContactUs` — mailto form present and email visible.

4. Gamble
   - Visit `/Gamble` — place a bet using paid coins. Confirm result and coin subtraction.

5. StreamViewer
   - Join a mock stream or existing stream, open Gift Box, send a gift (see animation), click Like (see counter update).

6. Admin
   - Login as admin, visit `/Admin`, confirm Gambling tab shows house stats.

7. Giveaway
   - If you invoked function manually, check `giveaway_records` table for entries.

---

## 8) Troubleshooting quick list

- Migration failed: ensure supabase CLI authorized and `supabase` points to the right project. Run `supabase status` and re-auth.
- Function deploy failed: check `supabase functions deploy randomCoinGiveaway --debug` for logs.
- Image not visible: make sure `public/mai_trollcity.jpeg` exists and browser cache cleared.
- Routes not showing: check console for JS errors and ensure `src/pages/index.jsx` contains the new routes.

---

## 9) Optional polish (recommended)

- Add SEO meta tags and OpenGraph image (use `mai_trollcity.jpeg`) in `index.html` or via React Helmet.
- Create a reusable `Footer` component and import across pages for consistency.
- Replace `mailto:` contact form with a small API endpoint or Supabase function to persist messages.

---

## 10) Commands summary (copy/paste)

```powershell
# 1. Copy hero image
Copy-Item -Path "C:\Users\justk\Downloads\Screenshot_6-8-2025_184649_looka.com.jpeg" -Destination .\public\mai_trollcity.jpeg -Force
# 2. Apply DB migration
cd C:\Apps\trollcity
supabase db push
# 3. Deploy function
supabase functions deploy randomCoinGiveaway
# 4. Start dev server
npm install
npm run dev
# 5. (Optional) Invoke the giveaway function for a test
supabase functions invoke randomCoinGiveaway --log
```

---

If you'd like, I can run any of these commands for you in your environment (for example: start the dev server or run the migration) — tell me which step to run and I'll execute it and return the output.

---

End of quick start — everything else is documented in `SETUP_GAMBLING_GIFTS_FEATURES.md` and `IMPLEMENTATION_SUMMARY.md`.
