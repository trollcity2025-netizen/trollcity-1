import { useEffect } from 'react';

/**
 * Hook to swap PWA manifest when in Deck mode.
 * When the user navigates to /deck, this swaps the manifest
 * so the Deck app can be installed as its own PWA.
 */
export function useDeckPWA() {
  useEffect(() => {
    const isDeckRoute = window.location.pathname.startsWith('/deck');

    if (isDeckRoute) {
      // Swap to Deck manifest
      const existingManifest = document.querySelector('link[rel="manifest"]');
      if (existingManifest) {
        existingManifest.setAttribute('href', '/deck-manifest.json');
      }

      // Update theme color for Deck
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) {
        themeMeta.setAttribute('content', '#6a00ff');
      }

      // Update title
      const prevTitle = document.title;
      document.title = 'Troll City Deck - Broadcast Control';

      // Update apple mobile web app title
      const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (appleTitle) {
        appleTitle.setAttribute('content', 'TC Deck');
      }

      return () => {
        // Restore original manifest when leaving Deck
        if (existingManifest) {
          existingManifest.setAttribute('href', '/manifest.json');
        }
        if (themeMeta) {
          themeMeta.setAttribute('content', '#05010a');
        }
        document.title = prevTitle;
        if (appleTitle) {
          appleTitle.setAttribute('content', 'Troll City');
        }
      };
    }
  }, []);
}
