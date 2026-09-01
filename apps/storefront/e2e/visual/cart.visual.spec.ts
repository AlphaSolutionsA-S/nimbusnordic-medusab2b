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
  // Wait for the add-to-cart server action to complete before navigating away.
  await expect(page.getByTestId('add-product-button')).toBeEnabled();
}

test('cart page renders correctly with an item added', async ({ page }, testInfo) => {
  const countryCode = testInfo.project.name.split('-')[0];
  await addTestProductToCart(page, countryCode);
  await page.goto(`/${countryCode}/cart`);
  await expect(page.getByTestId('cart-container')).toBeVisible();
  await waitForImagesToLoad(page);
  await expect(page).toHaveScreenshot(`cart-${testInfo.project.name}.png`, {
    fullPage: true,
  });
});
