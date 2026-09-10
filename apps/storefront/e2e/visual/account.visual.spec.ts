import { expect, test } from '@playwright/test';
import { waitForImagesToLoad } from './utils';

// No seeded customer/company exists (see apps/backend's initial-data-seed.ts) to test the
// authenticated account dashboard — this covers the unauthenticated account area (login page),
// which is the state the overwhelming majority of first-time visitors land on.
test('account (login) page renders correctly', async ({ page }, testInfo) => {
  const countryCode = testInfo.project.name.split('-')[0];
  await page.goto(`/${countryCode}/account`);
  await expect(page.getByTestId('login-page')).toBeVisible();
  await waitForImagesToLoad(page);
  await expect(page).toHaveScreenshot(`account-${testInfo.project.name}.png`, {
    fullPage: true,
  });
});
