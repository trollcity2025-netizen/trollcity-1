import { test, expect } from '@playwright/test';

test.describe('Broadcast Flow', () => {
  test('a user can start a live stream and connect to Agora and Mux', async ({ page }) => {
    // Create promises that will resolve when the expected network requests are made
    const agoraRequestPromise = page.waitForRequest(req => req.url().includes('agora'));
    const muxRequestPromise = page.waitForRequest(req => req.url().includes('mux'));

    // Navigate to the login page
    await page.goto('http://localhost:5176/login');

    // Fill in the login form and submit
    // Replace with your actual login credentials and selectors
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Wait for navigation to the dashboard or home page
    await page.waitForURL('http://localhost:5176/');

    // Navigate to the broadcast page
    // Replace with the actual selector for your broadcast link
    await page.click('a[href="/broadcast"]');
    await page.waitForURL('http://localhost:5176/broadcast/*');

    // Click the "Go Live" button
    // Replace with the actual selector for your "Go Live" button
    await page.click('button:has-text("Go Live")');

    // Wait for the network requests to be made
    const agoraRequest = await agoraRequestPromise;
    const muxRequest = await muxRequestPromise;

    // Assert that the requests were made
    expect(agoraRequest).toBeTruthy();
    expect(muxRequest).toBeTruthy();

    console.log(`Agora request URL: ${agoraRequest.url()}`);
    console.log(`Mux request URL: ${muxRequest.url()}`);
  });
});
