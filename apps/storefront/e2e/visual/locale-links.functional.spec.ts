import { expect, test } from '@playwright/test';

test('internal links preserve the active locale', async ({ page }, testInfo) => {
  const countryCode = testInfo.project.name.split('-')[0];
  // Start from the store (PLP) rather than "/" — the home route redirects
  // unauthenticated visitors to /account (no product links there), while the
  // store page is browsable as a guest and lists real product links.
  await page.goto(`/${countryCode}/store`);

  const firstProductLink = page.locator('a[href*="/products/"]').first();
  await firstProductLink.click();

  await expect(page).toHaveURL(new RegExp(`/${countryCode}/products/`));
});
