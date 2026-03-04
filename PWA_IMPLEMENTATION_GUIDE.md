# Troll City PWA Implementation Guide

This document describes the comprehensive Progressive Web App (PWA) implementation for Troll City, enabling native app-like experience for the livestreaming social platform.

## Table of Contents

1. [PWA Core Configuration](#pwa-core-configuration)
2. [Service Worker](#service-worker)
3. [Performance Optimization](#performance-optimization)
4. [Push Notifications](#push-notifications)
5. [Offline Mode](#offline-mode)
6. [Mobile App Experience](#mobile-app-experience)
7. [Background Sync](#background-sync)
8. [Realtime Stability](#realtime-stability)
9. [Integration Guide](#integration-guide)

---

## PWA Core Configuration

### Manifest (`public/manifest.json`)

The manifest provides PWA metadata for installation prompts:

```json
{
  "name": "Troll City - Social Livestream Platform",
  "short_name": "Troll City",
  "start_url": "/",
  "display": "standalone",
  "display_override": ["standalone", "fullscreen", "minimal-ui"],
  "orientation": "any",
  "theme_color": "#05010a",
  "background_color": "#05010a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "shortcuts": [
    { "name": "Go Live", "url": "/broadcast/setup" },
    { "name": "Watch Streams", "url": "/explore" }
  ]
}
```

### HTML Meta Tags (`index.html`)

Already configured with:
- Viewport with safe area support
- Theme colors
- Apple mobile web app capable
- Status bar style

---

## Service Worker

### Location: `src/service-worker.ts`

The service worker implements advanced caching strategies:

### Caching Strategies

| Asset Type | Strategy | Cache Duration |
|------------|----------|----------------|
| Static Assets (JS/CSS) | Cache First | 30 days |
| Images/Avatars | Stale While Revalidate | 7 days |
| API Calls | Network First | 5 minutes |
| Livestreams | Network Only | Never cached |

### Features

- **Versioned Caches**: Automatic cleanup of old caches on update
- **Offline Fallback**: Shows `offline.html` when network fails
- **Background Sync**: Queues actions made while offline
- **Push Notifications**: Handles Web Push API events

### Message Interface

The SW accepts messages from the main app:

```typescript
// Cache stream data
navigator.serviceWorker.controller?.postMessage({
  type: 'CACHE_STREAM_DATA',
  payload: { streamId, data }
});

// Clear all caches
navigator.serviceWorker.controller?.postMessage({
  type: 'CLEAR_CACHES'
});

// Trigger update
navigator.serviceWorker.controller?.postMessage({
  type: 'SKIP_WAITING'
});
```

---

## Performance Optimization

### Lazy Loading (Already in `App.tsx`)

```typescript
import { lazyWithRetry } from "./utils/lazyImport";

const Following = lazyWithRetry(() => import("./pages/Following"));
const ExploreFeed = lazyWithRetry(() => import("./pages/ExploreFeed"));
```

### Vite Configuration

The `vite.config.ts` includes:

- Manual chunk splitting for vendors
- PWA plugin with injectManifest strategy
- Code splitting for admin pages

### Bundle Optimization

```typescript
// vite.config.ts
manualChunks: (id) => {
  if (id.includes('node_modules')) {
    if (id.includes('react')) return 'vendor';
    if (id.includes('@supabase')) return 'supabase';
    if (id.includes('framer-motion')) return 'ui';
  }
  if (id.includes('admin')) return 'admin-core';
}
```

---

## Push Notifications

### Supabase Edge Function

**Location:** `supabase/functions/push-notifications/index.ts`

### Supported Notification Types

| Type | Description | Actions |
|------|-------------|---------|
| `BATTLE_INVITATION` | User challenged you | Join Battle, Decline |
| `NEW_LIVESTREAM` | Streamer went live | Watch Now, Dismiss |
| `GIFT_RECEIVED` | You received a gift | View Gift, Say Thanks |
| `PRIVATE_MESSAGE` | New message received | Reply, Mark Read |
| `FRIEND_REQUEST` | Someone wants to follow | Accept, Decline |
| `MODERATION_ALERT` | Action required | Review, Acknowledge |
| `STREAM_GOING_LIVE` | Scheduled stream starting | Watch Now, Remind Later |

### VAPID Keys Setup

Required environment variables:

```bash
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_SUBJECT=mailto:admin@maitrollcity.com
```

### Usage

```typescript
const { subscribeToPush, pushPermission } = usePWA();

// Request permission and subscribe
if (pushPermission === 'default') {
  await subscribeToPush();
}
```

---

## Offline Mode

### Offline Fallback Page (`public/offline.html`)

Features:
- Branded design matching Troll City theme
- Links to cached content
- Auto-retry when connection restored
- Connection status indicator

### Cached Content While Offline

- City Center dashboard
- User profiles (cached)
- Chat messages (cached)
- Navigation structure
- Essential assets

### Background Sync Queue

Actions queued when offline:
- Chat messages
- Reactions
- Gift sends
- Follow actions
- Profile updates

---

## Mobile App Experience

### CSS Enhancements (`src/styles/pwa-mobile.css`)

#### Safe Area Support

```css
@supports (padding-top: env(safe-area-inset-top)) {
  .pwa-safe-area {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

#### Standalone Mode Styles

```css
@media all and (display-mode: standalone) {
  html, body, #root {
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }
}
```

### Touch Optimizations

- Smooth scrolling with `-webkit-overflow-scrolling: touch`
- Prevent zoom on inputs (16px font-size minimum)
- Touch action manipulation for better responsiveness
- Remove tap highlight delays

---

## Background Sync

### Implementation

The service worker intercepts POST requests to specific endpoints:

```typescript
// When offline, chat messages are queued
const response = await fetch('/chat', {
  method: 'POST',
  body: JSON.stringify(message)
});

// Returns: { queued: true, message: 'Will sync when online' }
```

### Sync Events

```typescript
self.addEventListener('sync', (event) => {
  if (event.tag === 'chat-messages') {
    event.waitUntil(syncChatMessages());
  }
});
```

---

## Realtime Stability

### Hook: `useRealtimeStability`

**Location:** `src/hooks/useRealtimeStability.ts`

Features:
- Automatic reconnect on network drops
- Tab visibility change handling
- Exponential backoff retry logic
- Connection health monitoring

### Usage

```typescript
import { useRealtimeStability } from './hooks/useRealtimeStability';

function MyComponent() {
  const { connectionState, isConnected, triggerReconnect } = useRealtimeStability({
    channelName: 'room-123',
    onReconnect: () => console.log('Reconnected!'),
    onDisconnect: () => console.log('Disconnected!'),
    maxRetries: 10
  });
  
  return (
    <div>
      {connectionState.status}
    </div>
  );
}
```

### Livestream Stability

```typescript
const { connectionState, handleReconnect } = useLivestreamStability(streamId);
```

---

## Integration Guide

### 1. Wrap App with PWAProvider

Update `src/main.tsx`:

```typescript
import { PWAProvider } from './contexts/PWAContext';

createRoot(rootElement).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <GlobalAppProvider>
          <PWAProvider> {/* Add this */}
            <App />
          </PWAProvider>
        </GlobalAppProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);
```

### 2. Add Install Prompt

In your main layout component:

```typescript
import { InstallPrompt, OfflineBanner, UpdateBanner } from './components/pwa';
import { usePWA } from './contexts/PWAContext';

function AppLayout() {
  return (
    <>
      <InstallPrompt variant="banner" />
      <OfflineBanner />
      <UpdateBanner />
      {/* Your app content */}
    </>
  );
}
```

### 3. Use PWA Hooks

```typescript
import { usePWA, useNetworkStatus, useInstallState } from './contexts/PWAContext';

function MyComponent() {
  const { isInstalled, canInstall, promptInstall } = useInstallState();
  const { isOnline, isSlowConnection } = useNetworkStatus();
  
  // Handle offline state
  if (!isOnline) {
    return <OfflineView />;
  }
  
  // Handle slow connection
  if (isSlowConnection) {
    return <LowBandwidthView />;
  }
}
```

### 4. Cache Content

```typescript
const { cacheStream, cacheProfile, cacheChat } = usePWA();

// After loading stream data
cacheStream(streamId, streamData);

// After loading profile
cacheProfile(userId, profileData);

// After loading messages
cacheChat(roomId, messages);
```

### 5. Prefetch Upcoming Streams

```typescript
const { prefetchStream } = usePWA();

// When user scrolls near the next stream
useEffect(() => {
  if (nextStreamId) {
    prefetchStream(nextStreamId);
  }
}, [nextStreamId]);
```

---

## File Structure

```
public/
├── manifest.json           # PWA manifest
├── offline.html            # Offline fallback page
├── icons/
│   ├── icon-192.png
│   └── icon-512.png

src/
├── service-worker.ts       # Service worker implementation
├── contexts/
│   └── PWAContext.tsx      # PWA context provider
├── components/pwa/
│   ├── InstallPrompt.tsx   # Install prompt UI
│   └── index.ts            # Component exports
├── hooks/
│   ├── useRealtimeStability.ts  # Realtime stability hook
│   └── useInstallPrompt.ts      # Install prompt hook (existing)
├── pwa/
│   └── install.ts          # Install detection utilities (existing)
└── styles/
    └── pwa-mobile.css      # Mobile experience styles

supabase/
└── functions/
    └── push-notifications/
        └── index.ts        # Push notification edge function
```

---

## Environment Variables

Add to `.env`:

```bash
# VAPID Keys for Push Notifications
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:admin@maitrollcity.com
```

---

## Testing Checklist

### Chrome DevTools

1. Open Application tab
2. Check Manifest section
3. Check Service Workers section
4. Test "Add to home screen" prompt

### Lighthouse Audit

Target scores:
- Performance: 90+
- PWA: 90+
- Accessibility: 90+
- Best Practices: 90+

### Device Testing

- [ ] Chrome on Android
- [ ] Edge on Windows
- [ ] Safari on iOS (limited PWA support)
- [ ] Chrome on iOS
- [ ] Standalone mode (after install)
- [ ] Offline functionality
- [ ] Push notifications
- [ ] Background sync

---

## Browser Compatibility

| Feature | Chrome | Edge | Safari | Firefox |
|---------|--------|------|--------|---------|
| Install Prompt | ✓ | ✓ | ✗ | ✗ |
| Push Notifications | ✓ | ✓ | ✓ (16.4+) | ✓ |
| Background Sync | ✓ | ✓ | ✗ | ✗ |
| Periodic Sync | ✓ | ✓ | ✗ | ✗ |
| Offline Support | ✓ | ✓ | ✓ | ✓ |

---

## Security Considerations

1. **HTTPS Required**: PWA features require HTTPS in production
2. **Service Worker Scope**: Limited to `/` scope
3. **No Auth Caching**: Authentication responses are never cached
4. **VAPID Keys**: Keep private key secure on server only
5. **Content Security Policy**: Configure CSP for service worker

---

## Troubleshooting

### Service Worker Not Registering

1. Check HTTPS is enabled
2. Clear browser cache and reload
3. Check DevTools > Application > Service Workers

### Push Notifications Not Working

1. Check VAPID keys are configured
2. Verify user granted notification permission
3. Check subscription in database

### Offline Page Not Showing

1. Ensure `offline.html` is in precache manifest
2. Check navigation requests are being handled
3. Verify service worker is activated

---

## Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3.5s |
| Lighthouse Performance | 90+ |
| Lighthouse PWA | 90+ |
| Bundle Size (initial) | < 200KB |

---

## Future Enhancements

- [ ] File System Access API for uploads
- [ ] Screen Wake Lock during streams
- [ ] Web Share API integration
- [ ] Payment Request API for purchases
- [ ] Media Session API for stream controls

---

For questions or issues, refer to the PWA documentation:
- [Google PWA Guide](https://web.dev/progressive-web-apps/)
- [MDN PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Workbox Documentation](https://developer.chrome.com/docs/workbox/)
