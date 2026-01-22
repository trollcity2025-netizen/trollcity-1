// Simple CLI/utility to send a global push notification to all users via ntfy
// Usage: node sendGlobalNotification.js "Title" "Message"

const fetch = require('node-fetch');

const NTFY_TOPIC = 'trollcity-global';
const NTFY_URL = 'https://ntfy.sh';

async function sendGlobalNotification(title, message) {
  const res = await fetch(`${NTFY_URL}/${NTFY_TOPIC}`, {
    method: 'POST',
    headers: {
      'Title': title,
      'Priority': '5',
    },
    body: message,
  });
  if (!res.ok) {
    throw new Error(`ntfy push failed: ${res.status}`);
  }
  console.log('Notification sent!');
}

if (require.main === module) {
  const [,, title, ...msgParts] = process.argv;
  if (!title || msgParts.length === 0) {
    console.error('Usage: node sendGlobalNotification.js "Title" "Message"');
    process.exit(1);
  }
  sendGlobalNotification(title, msgParts.join(' ')).catch(err => {
    console.error('Failed to send notification:', err);
    process.exit(1);
  });
}
