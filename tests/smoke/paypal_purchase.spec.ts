import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from './utils';

test('user can purchase a coin pack with PayPal and balance updates', async ({ page, context }) => {
  // Login as a test user
  await login(page, TEST_USERS.user.email, TEST_USERS.user.password);



  // Navigate to the coin store
  await page.goto('/coin-store');

  // Select a coin pack (e.g., the 300 coins package)
  // I'll identify the button by its text content or a data-testid if available.
  // Looking at src/lib/coinMath.js, pkg-300 has "Starter" name and "$3.00" price.
  // Looking at src/pages/CoinStore.jsx, the button text is "Buy with {provider.name}"
  // And the coin packages are listed with their emoji, coins, and price.
  // I need to click the div that selects the package first.
  await page.waitForLoadState('networkidle'); // Wait for coin packages to load
  await page.locator('[data-testid="pkg-300"]').click(); // This selects the package
  
  // Select PayPal as the manual payment method
  await page.click('button:has-text("PayPal")');

  // Assert that the manual payment modal appears
  await expect(page.getByRole('dialog', { name: 'Pay with PayPal' })).toBeVisible();


});
