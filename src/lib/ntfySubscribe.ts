// Simple ntfy subscribe logic for browser
// Call this on user login or app load to subscribe to global topic

export function subscribeToNtfyGlobal() {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  new Notification('🔔 Notifications enabled!', {
    body: 'You will receive Troll City updates.',
    icon: '/img/logo.png',
  });
}
