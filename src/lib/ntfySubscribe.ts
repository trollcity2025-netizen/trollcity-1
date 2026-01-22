// Simple ntfy subscribe logic for browser
// Call this on user login or app load to subscribe to global topic

export function subscribeToNtfyGlobal() {
  if (typeof window === 'undefined') return;
  // Subscribe to ntfy.sh topic for browser notifications
  // This will prompt for notification permission if not already granted
  if ('Notification' in window) {
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') {
        // Subscribe by opening a persistent EventSource connection (optional)
        // Or just rely on the user installing the ntfy app or browser extension
        // Optionally, show a welcome notification
        new Notification('🔔 Notifications enabled!', {
          body: 'You will receive Troll City updates.',
          icon: '/img/logo.png',
        });
      }
    });
  }
}
