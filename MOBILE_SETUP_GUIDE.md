# Troll City - Mobile & Web Unified Build Setup

## 🎯 Overview

This is a **single codebase** that deploys to:
- 🌐 **Web** (Vercel/production)
- 📱 **Android** (Google Play via Capacitor wrapper)

Both platforms use the **same Supabase database** and **same authentication**.

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd E:\troll\trollcity-1
npm install
```

This will install:
- All web dependencies
- Capacitor core & Android platform
- Mobile-specific plugins (StatusBar, Keyboard, etc.)

### 2. Initialize Capacitor (First Time Only)

```bash
npm run cap:init
npm run cap:add:android
```

This creates the `android/` directory with the native Android wrapper.

### 3. Development Workflow

#### Web Development (Local)
```bash
npm run dev
```
Opens at `https://localhost:5173/`

#### Android Development
```bash
# Build web + sync to Android + run on device/emulator
npm run cap:run:android

# OR for live reload during development
npm run android:dev
```

---

## 📱 Mobile Fullscreen & Safe Area

### What Was Fixed

1. **Viewport Configuration**
   - Added `viewport-fit=cover` for notch devices
   - Added `interactive-widget=resizes-content` for keyboard handling

2. **CSS System**
   - New file: `src/styles/mobile-fullscreen.css`
   - Uses `100dvh` (dynamic viewport height) instead of `100vh`
   - Automatic safe area padding with `env(safe-area-inset-*)`
   - Prevents double-scroll issues
   - Handles keyboard overlay properly

3. **Platform Integration**
   - New file: `src/lib/mobilePlatform.ts`
   - Initializes Capacitor plugins (StatusBar, Keyboard, etc.)
   - Handles Android back button
   - Manages app state (foreground/background)

4. **Responsive Broadcast/Video**
   - All video containers use `.broadcast-fullscreen-mobile` class
   - Respects safe areas while maintaining fullscreen
   - No content overflow issues

### Available CSS Utilities

```css
/* Safe area padding */
.safe-top      /* padding-top: safe-area-inset-top */
.safe-bottom   /* padding-bottom: safe-area-inset-bottom */
.safe-all      /* all safe area padding */

/* Dynamic viewport height */
.h-dvh         /* height: 100dvh */
.min-h-dvh     /* min-height: 100dvh */

/* Mobile scroll containers */
.mobile-scroll-container   /* Proper scrolling with momentum */
.mobile-fullscreen-container /* Full viewport with safe areas */
```

---

## 🗄️ Shared Supabase Access

### Current Setup
- **Web**: Uses `src/lib/supabase.ts`
- **Android**: Uses the **same file** (no separate client needed)
- Environment variables loaded from `.env` at build time

### Auth Flow
Both web and Android use the same Supabase auth:
```typescript
import { supabase } from '@/lib/supabase';

// Login works identically on web & mobile
await supabase.auth.signInWithPassword({ email, password });
```

### Database Tables
All tables are shared:
- `user_profiles`
- `streams`
- `transactions`
- `gifts`
- `troll_coins`
- etc.

No mobile-specific tables needed!

---

## 🛠️ Build Scripts

### Web Only
```bash
npm run build:web       # Build web app to dist/
npm run preview         # Preview production build locally
```

### Android
```bash
npm run cap:sync:android      # Build web + copy to android/
npm run cap:open:android      # Open Android Studio
npm run cap:run:android       # Build + Run on device
npm run android:dev           # Development with live reload
```

### Combined Workflow
```bash
# 1. Make changes in src/
# 2. Test on web
npm run dev

# 3. Test on Android
npm run cap:run:android
```

---

## 📐 Project Structure

```
trollcity-1/
├── src/                        # Web app source (shared with Android)
│   ├── components/
│   ├── pages/
│   ├── lib/
│   │   ├── supabase.ts         # Shared Supabase client
│   │   └── mobilePlatform.ts   # Mobile-specific features
│   ├── styles/
│   │   └── mobile-fullscreen.css  # Mobile CSS fixes
│   └── index.css               # Main styles (imports mobile CSS)
├── supabase/                   # Supabase functions & migrations
├── android/                    # Capacitor Android wrapper (auto-generated)
├── dist/                       # Web build output (synced to android/)
├── capacitor.config.json       # Capacitor configuration
├── package.json                # Build scripts
└── trollcity.code-workspace    # VS Code multi-root workspace
```

---

## 🔧 VS Code Workspace

Open the workspace for a better development experience:

1. Open VS Code
2. File → Open Workspace from File
3. Select `trollcity.code-workspace`

### Available Tasks (Ctrl+Shift+B)

- 🌐 **Dev: Web Server** - Start Vite dev server
- 🏗️ **Build: Web** - Build production web app
- 🔄 **Android: Sync** - Sync web build to Android
- 📱 **Android: Open Studio** - Open Android Studio
- ▶️ **Android: Run** - Build and run on device
- 🔥 **Android: Dev** - Live reload development

---

## 🎨 Mobile UI Guidelines

### 1. Always Use Safe Areas

```tsx
// ❌ Don't do this
<div className="fixed top-0 w-full">
  <Navbar />
</div>

// ✅ Do this
<div className="fixed top-0 w-full safe-top">
  <Navbar />
</div>
```

### 2. Use Dynamic Viewport Heights

```tsx
// ❌ Don't do this
<div className="h-screen">
  <Content />
</div>

// ✅ Do this
<div className="h-dvh">
  <Content />
</div>
```

### 3. Prevent Content Overflow

```tsx
// ❌ Avoid absolute positioning without constraints
<div className="absolute top-0 left-0 right-0 bottom-0">
  <VideoPlayer />
</div>

// ✅ Use mobile-friendly container
<div className="broadcast-fullscreen-mobile">
  <VideoPlayer />
</div>
```

### 4. Handle Keyboard Properly

```tsx
// Input fields automatically scroll into view
// No manual handling needed due to mobile-fullscreen.css

<input
  type="text"
  className="w-full px-4 py-2"
  placeholder="Type here..."
/>
```

---

## 🔐 Environment Variables

Create `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_LIVEKIT_URL=your_livekit_url
# ... other vars
```

**Important**: Capacitor uses these at **build time**, not runtime.
Always run `npm run cap:sync:android` after changing `.env`.

---

## 📦 Android Build for Google Play

### Release Build

1. **Generate Keystore** (first time only)
```bash
cd android/app
keytool -genkey -v -keystore trollcity-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias trollcity
```

2. **Update capacitor.config.json**
```json
{
  "android": {
    "buildOptions": {
      "keystorePath": "app/trollcity-release.jks",
      "keystoreAlias": "trollcity",
      "releaseType": "AAB"
    }
  }
}
```

3. **Build Release**
```bash
npm run cap:sync:android
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

Upload this `.aab` file to Google Play Console.

---

## 🐛 Troubleshooting

### "Purple container showing website" on mobile

**Fixed!** The issue was:
1. Viewport not using `100dvh`
2. Missing safe area padding
3. Fixed positioning without safe area handling

Solution implemented in `src/styles/mobile-fullscreen.css`

### Android back button doesn't work

Check `src/lib/mobilePlatform.ts` - back button handler is registered.
Ensure Capacitor plugins are installed:
```bash
npm install @capacitor/app
```

### Keyboard covers input fields

**Fixed!** Mobile CSS automatically handles this with:
- `scroll-margin-bottom` on inputs
- Keyboard event listeners in `mobilePlatform.ts`

### Web build works but Android doesn't

1. Check if build synced: `npm run cap:sync:android`
2. Check Android logcat: `adb logcat | grep Capacitor`
3. Enable web debugging: Set `webContentsDebuggingEnabled: true` in capacitor.config.json

---

## 📊 Testing Checklist

### Web Testing
- [ ] Fullscreen works on desktop
- [ ] Responsive on mobile browser
- [ ] No content overflow
- [ ] Auth works
- [ ] Supabase queries work

### Android Testing
- [ ] App opens fullscreen (no URL bar)
- [ ] Safe areas respected (notch devices)
- [ ] Status bar themed correctly
- [ ] Keyboard doesn't cover inputs
- [ ] Back button works
- [ ] Auth persists across app restarts
- [ ] Broadcasts play correctly
- [ ] No scrolling issues

---

## 🎯 Next Steps

1. **Install Capacitor**
   ```bash
   npm install
   npm run cap:init
   npm run cap:add:android
   ```

2. **Test Web**
   ```bash
   npm run dev
   ```

3. **Test Android**
   ```bash
   npm run cap:run:android
   ```

4. **Deploy to Production**
   - Web: Push to GitHub → Vercel auto-deploys
   - Android: Build AAB → Upload to Google Play

---

## 📚 Resources

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Safe Area Insets Guide](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)

---

## 🤝 Support

Issues? Check:
1. VS Code Tasks output (Ctrl+Shift+B)
2. Browser console (web)
3. `adb logcat` (Android)
4. Capacitor logs in Android Studio

---

**Built with ❤️ for Troll City**
