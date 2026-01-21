/**
 * Mobile Platform Integration
 * Handles Capacitor plugins for Android/iOS native features
 */

import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';

export const isMobilePlatform = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'ios', 'android', or 'web'

/**
 * Initialize mobile platform features
 */
export async function initMobilePlatform() {
  if (!isMobilePlatform) {
    console.log('[Mobile] Running on web platform');
    return;
  }

  console.log(`[Mobile] Initializing platform: ${platform}`);

  try {
    // Configure Status Bar
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#06030e' });
    await StatusBar.setOverlaysWebView({ overlay: false });

    // Configure Keyboard
    Keyboard.setAccessoryBarVisible({ isVisible: false });
    
    // Keyboard event listeners
    Keyboard.addListener('keyboardWillShow', (info) => {
      console.log('[Mobile] Keyboard will show:', info.keyboardHeight);
      document.body.classList.add('keyboard-open');
      // Adjust viewport if needed
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    Keyboard.addListener('keyboardWillHide', () => {
      console.log('[Mobile] Keyboard will hide');
      document.body.classList.remove('keyboard-open');
    });

    // Handle back button (Android)
    CapApp.addListener('backButton', ({ canGoBack }) => {
      console.log('[Mobile] Back button pressed, canGoBack:', canGoBack);
      
      // Custom back button handling
      // You can add custom logic here, e.g., close modals, navigate back, etc.
      if (!canGoBack) {
        // Ask user if they want to exit the app
        const shouldExit = window.confirm('Exit Troll City?');
        if (shouldExit) {
          CapApp.exitApp();
        }
      } else {
        window.history.back();
      }
    });

    // Handle app state changes
    CapApp.addListener('appStateChange', ({ isActive }) => {
      console.log('[Mobile] App state changed. Active:', isActive);
      // You can pause/resume features here
      if (isActive) {
        // App came to foreground
        document.dispatchEvent(new Event('app-resumed'));
      } else {
        // App went to background
        document.dispatchEvent(new Event('app-paused'));
      }
    });

    // Handle URL open (deep links)
    CapApp.addListener('appUrlOpen', (data) => {
      console.log('[Mobile] App opened with URL:', data.url);
      // Handle deep link navigation
      const url = new URL(data.url);
      const path = url.pathname;
      if (path) {
        // Navigate to the path using your router
        window.location.href = path;
      }
    });

    // Hide splash screen after initialization
    await SplashScreen.hide();

    console.log('[Mobile] Platform initialization complete');
  } catch (error) {
    console.error('[Mobile] Platform initialization error:', error);
  }
}

/**
 * Show native status bar
 */
export async function showStatusBar() {
  if (isMobilePlatform) {
    await StatusBar.show();
  }
}

/**
 * Hide native status bar
 */
export async function hideStatusBar() {
  if (isMobilePlatform) {
    await StatusBar.hide();
  }
}

/**
 * Set status bar color
 */
export async function setStatusBarColor(color: string) {
  if (isMobilePlatform) {
    await StatusBar.setBackgroundColor({ color });
  }
}

/**
 * Hide keyboard programmatically
 */
export async function hideKeyboard() {
  if (isMobilePlatform) {
    await Keyboard.hide();
  }
}

/**
 * Show keyboard programmatically
 */
export async function showKeyboard() {
  if (isMobilePlatform) {
    await Keyboard.show();
  }
}

/**
 * Get app info
 */
export async function getAppInfo() {
  if (isMobilePlatform) {
    return await CapApp.getInfo();
  }
  return {
    name: 'Troll City',
    id: 'com.trollcity.app',
    build: '1',
    version: '1.0.0',
  };
}

/**
 * Exit app (Android only)
 */
export async function exitApp() {
  if (platform === 'android') {
    await CapApp.exitApp();
  }
}
