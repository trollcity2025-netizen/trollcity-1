# Quick Fixes to Apply

## 1. Fix Application Page Redirect

**File:** `src/App.tsx`

The auto-routing logic is redirecting from `/apply`. The fix has been applied - the `/apply` path is now in the `noRedirectPaths` array.

## 2. Fix Safety Page Refresh

**File:** `src/pages/Safety.tsx`

The Safety page should not have any redirect logic. Ensure it's a simple React component without navigation logic.

**Check:** Make sure there's no `useEffect` with `navigate()` in Safety.tsx that's causing the refresh.

## 3. Add User Management to Admin Dashboard

**File Created:** `src/pages/admin/components/UserManagementPanel.tsx`

**To integrate into AdminDashboard.tsx:**

1. Import the component:
```typescript
import UserManagementPanel from './components/UserManagementPanel'
```

2. In the `renderTabContent()` function, find the `case 'users':` section and replace with:
```typescript
case 'users':
  return <UserManagementPanel />
```

Or add it as a new tab option if you want both UsersPanel and UserManagementPanel.

## 4. Update Routes

**File:** `src/App.tsx`

Ensure these routes exist:
- `/apply` → Application page
- `/safety` → Safety page
- `/coins/complete` → CoinsComplete page
- `/payouts/setup` → PayoutSetupPage

## 5. Safety Page Fix

If Safety page is refreshing, check for:
- Any `window.location` usage
- Any form submissions without `preventDefault()`
- Any `useEffect` that navigates

The Safety page should be a static informational page with no navigation logic.

