import { expect, Page, test } from '@playwright/test';
import { waitForImagesToLoad } from './utils';

// Real seeded product handle (see apps/backend's seeded catalog via `/store/products`).
const TEST_PRODUCT_HANDLE = '1080p-hd-pro-webcam-superior-video-privacy-enabled';

async function addTestProductToCart(page: Page, countryCode: string) {
  await page.goto(`/${countryCode}/products/${TEST_PRODUCT_HANDLE}`);
  // The product page streams in `ProductActions` behind a Suspense boundary
  // whose fallback is a full (not skeleton) `ProductActions` instance
  // (templates/index.tsx) — briefly, both the fallback and the resolved
  // component can be in the DOM at once. Wait for it to settle to one before
  // interacting, or the click can land on a stale, about-to-be-removed node.
  await expect(page.getByTestId('add-product-button')).toHaveCount(1);
  await page.locator('table input[type="number"]').first().fill('1');
  await page.getByTestId('add-product-button').click();
  await expect(page.getByTestId('add-product-button')).toBeEnabled();
}

// No seeded customer/company exists to test an authenticated checkout (see
// apps/backend's initial-data-seed.ts) — this covers the guest checkout
// state, which the checkout page renders directly (with a sign-in prompt
// alongside the shipping/contact form) rather than hard-redirecting.
test('checkout page renders correctly for a guest with a non-empty cart', async ({ page }, testInfo) => {
  const countryCode = testInfo.project.name.split('-')[0];
  await addTestProductToCart(page, countryCode);
  await page.goto(`/${countryCode}/checkout`);
  await waitForImagesToLoad(page);
  await expect(page).toHaveScreenshot(`checkout-${testInfo.project.name}.png`, {
    fullPage: true,
  });
});
