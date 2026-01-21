# 🚀 Troll City - Quick Command Reference

## Initial Setup (Run Once)

```bash
# Navigate to project
cd E:\troll\trollcity-1

# Install dependencies (already done)
npm install

# Initialize Capacitor
npx cap init trollcity com.trollcity.app --web-dir=dist

# Add Android platform
npx cap add android
```

---

## Daily Development

### Web Development
```bash
# Start dev server (with hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Type check
npm run check
```

### Android Development
```bash
# Build web + sync to Android + run
npm run cap:run:android

# Live reload development (recommended)
npm run android:dev

# Just sync (after web changes)
npm run cap:sync:android

# Open in Android Studio
npm run cap:open:android
```

---

## VS Code Quick Tasks (Ctrl+Shift+B)

- 🌐 **Dev: Web Server** - Start development server
- 🏗️ **Build: Web** - Build production web app
- 🔄 **Android: Sync** - Sync web build to Android
- 📱 **Android: Open Studio** - Open Android Studio
- ▶️ **Android: Run** - Build, sync, and run on device
- 🔥 **Android: Dev** - Development with live reload

---

## Production Deployment

### Web (Vercel)
```bash
# Commit and push (Vercel auto-deploys)
git add .
git commit -m "Your message"
git push origin main
```

### Android (Google Play)
```bash
# 1. Sync latest build
npm run cap:sync:android

# 2. Build release AAB
cd android
./gradlew bundleRelease

# 3. Find output
# android/app/build/outputs/bundle/release/app-release.aab

# 4. Upload to Google Play Console
```

---

## Troubleshooting

### Reset Everything
```bash
# Clean all build artifacts
rm -rf dist node_modules android/.gradle android/app/build
npm install
npm run cap:sync:android
```

### View Android Logs
```bash
# Connect device/emulator then:
adb logcat | grep -i capacitor
```

### Check Capacitor Status
```bash
npx cap doctor
```

---

## Environment Variables

Edit `.env` file, then:
```bash
# For web changes
npm run dev

# For Android changes (rebuild required)
npm run cap:sync:android
```

---

## Git Workflow

```bash
# Check status
git status

# Stage all changes
git add .

# Commit with message
git commit -m "Fix mobile fullscreen issues"

# Push to GitHub (triggers Vercel deploy)
git push origin main
```

---

## Useful Capacitor Commands

```bash
# Check Capacitor setup
npx cap doctor

# Update Capacitor
npm install @capacitor/cli@latest @capacitor/core@latest @capacitor/android@latest

# Sync all platforms
npx cap sync

# Copy web build to native projects
npx cap copy

# Update native dependencies
npx cap update
```

---

## 🎯 Most Common Commands

**Starting development:**
```bash
npm run dev                    # Web only
npm run android:dev            # Android with live reload
```

**Building for production:**
```bash
npm run build                  # Web
npm run cap:sync:android       # Android
```

**Testing on device:**
```bash
npm run cap:run:android
```

---

## 📱 Mobile Testing Tips

1. **Enable USB Debugging on Android device**
   - Settings → About Phone → Tap "Build number" 7 times
   - Settings → Developer Options → Enable "USB Debugging"

2. **Connect device via USB**
   - Allow USB debugging prompt
   - Run `adb devices` to verify

3. **Run on device**
   ```bash
   npm run cap:run:android
   ```

4. **View device logs**
   ```bash
   adb logcat
   ```

---

## 🔍 Debugging

### Web (Browser DevTools)
```bash
npm run dev
# Open https://localhost:5173
# Press F12 for DevTools
```

### Android (Chrome DevTools)
```bash
# Run app on device
npm run cap:run:android

# Open Chrome on desktop
# Go to: chrome://inspect
# Find your device and click "inspect"
```

---

## 📦 Package Management

```bash
# Install new package
npm install package-name

# Update all packages
npm update

# Check for outdated packages
npm outdated

# Clean install
rm -rf node_modules package-lock.json
npm install
```

---

**Quick Start Reminder:**
1. `npm run dev` - Test on web
2. `npm run cap:run:android` - Test on Android
3. `git push` - Deploy web to production
4. Build AAB - Deploy Android to Google Play

---

**Need help?** Check `MOBILE_SETUP_GUIDE.md` for detailed instructions.
