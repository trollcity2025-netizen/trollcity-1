// ntfy notification utility
// Sends a push notification to all users via ntfy public server

import fetch from 'node-fetch';

const NTFY_TOPIC = 'trollcity-global'; // All users subscribe to this topic
const NTFY_URL = 'https://ntfy.sh';

export async function sendGlobalNotification(title: string, message: string) {
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
  return true;
}
