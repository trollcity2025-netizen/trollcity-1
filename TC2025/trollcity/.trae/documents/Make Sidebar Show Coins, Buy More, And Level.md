## Objectives
- Apply a full-page lightning effect overlay on Home to match the referenced look.
- Remove the small green “Troll city” label from the overlay.
- Fix route navigation so all sidebar and buttons direct correctly.

## Implementation Targets
- `src/components/TrollCityShower.jsx`:
  - Replace current subtle green brand overlay with animated lightning streaks.
  - CSS-only: multiple diagonal streaks (white/cyan), flicker/flash keyframes, random positions.
  - Keep `pointer-events-none` and proper `z-index` so UI remains usable.
- `src/pages/Home.jsx`:
  - Continue to mount `TrollCityShower` at the top of the page.
- `src/utils/index.js:createPageUrl`:
  - Correct case-sensitive paths to match `src/pages/index.jsx`:
    - `Home` → `/Home` (and `/` supported)
    - `Store` → `/Store`
    - `Profile` → `/Profile`
    - `Admin` → `/Admin`
    - `Manual Coins Payment` → `/ManualCoinsPayment`
    - Keep other names capitalized to `/Name` so they match defined routes like `/Trending`, `/Following`.

## Validation
- In the live preview (`http://localhost:5174/`):
  - Visually confirm lightning overlay animates without blocking clicks.
  - Verify Home header matches the dark aesthetic without the green mini label.
  - Click each sidebar item and key CTAs (Store, Go Live, Trending, Following, Profile, Admin) to confirm navigation works.
  - Confirm Store’s “Manual Coins Payment” routes to `/ManualCoinsPayment`.

## Contingency
- If any nav item refers to a route not present, temporarily hide or route to a placeholder matching the original name and add a TODO.

## Next Step
- With approval, I will implement the overlay and URL fixes, then verify in the preview.