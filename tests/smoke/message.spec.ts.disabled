import { test, expect } from '@playwright/test';
import { attachDiagnostics, login, setupDiagnostics, TEST_USERS } from './utils';

test.describe('Messaging Feature', () => {
  test('should allow a user to send a message and check for TCPS/heartbeat errors', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);

    let tcpsErrorFound = false;
    let heartbeatErrorFound = false;

    page.on('console', (msg) => {
      const messageText = msg.text();
      if (messageText.includes('tcps')) {
        tcpsErrorFound = true;
        console.error('TCPS error detected in console:', messageText);
      }
      if (messageText.includes('heartbeat for ops counter')) {
        heartbeatErrorFound = true;
        console.error('Heartbeat error detected in console:', messageText);
      }
    });

    page.on('requestfailed', (request) => {
      const url = request.url();
      const failure = request.failure();
      if (failure && (url.includes('tcps') || url.includes('heartbeat'))) {
        tcpsErrorFound = true;
        console.error('TCPS/Heartbeat network request failed:', url, failure.errorText);
      }
    });

    // Log in as chatter1
    await login(page, 'chatter1@test.com', TEST_USERS.user.password);
    await expect(page.getByRole('heading', { name: 'City Feed' })).toBeVisible();

    // Navigate to the pods listing page
    await page.goto('/pods');

    // Click the button to start creating a new pod
    await page.getByRole('button', { name: 'Start a Pod' }).click();

    // Fill in the new room title
    await page.getByPlaceholder('What are we talking about?').fill('Test Pod for TCPS Error Check');

    // Click the "Go Live" button to create the pod
    await page.getByRole('button', { name: 'Go Live', exact: true }).click();

    // Wait for the URL to change to the new pod room
    await page.waitForURL(/\/pods\/.+/); // Wait for a URL like /pods/<podId>

    // Try to find a chat input field and send a message on the pod page
    const chatInput = page.getByPlaceholder('Say something...');
    const sendButton = page.getByRole('button', { name: 'Send' });

    await expect(chatInput).toBeVisible();
    await chatInput.fill('Hello chatter2, this is a test message in a pod!');
    await sendButton.click();
    console.log('Message sent successfully in pod!');
    // Wait for a short period to allow any async errors to surface
    await page.waitForTimeout(2000);

    // Assert that no specific errors were found
    expect(tcpsErrorFound, 'TCPS error should not be found').toBe(false);
    expect(heartbeatErrorFound, 'Heartbeat error should not be found').toBe(false);

    await attachDiagnostics(testInfo, diagnostics);
  });
});
