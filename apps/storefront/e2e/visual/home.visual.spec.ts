import { expect, test } from '@playwright/test';
import { waitForImagesToLoad } from './utils';

// This storefront's home route redirects unauthenticated visitors to
// /account (see src/app/[countryCode]/(main)/page.tsx) — no seeded
// customer/company exists (see apps/backend's initial-data-seed.ts) to
// exercise the authenticated home page. This baseline captures the real,
// honest behavior a guest sees when visiting "/".
test('home page renders correctly', async ({ page }, testInfo) => {
  const countryCode = testInfo.project.name.split('-')[0];
  await page.goto(`/${countryCode}`);
  await expect(page.getByTestId('login-page')).toBeVisible();
  await waitForImagesToLoad(page);
  await expect(page).toHaveScreenshot(`home-${testInfo.project.name}.png`, {
    fullPage: true,
  });
});
