import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from './utils';

const MOBILE_ROUTES = [
  '/mobile/tcps',
  '/mobile/troll-pods',
  '/mobile/watch',
  '/mobile/pods',
];

for (const [role, user] of Object.entries(TEST_USERS)) {
  test(`Mobile shell navigation for ${role} role`, async ({ page }) => {
    await login(page, user.email, user.password);

    for (const route of MOBILE_ROUTES) {
      await page.goto(route);
      await page.waitForURL(`**${route}`);
      const currentPath = new URL(page.url()).pathname;
      expect(currentPath).toBe(route);
    }
  });
}
