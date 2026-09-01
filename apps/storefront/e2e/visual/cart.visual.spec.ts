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
  // The button only emits an event onto an event bus (see
  // product-variants-table/index.tsx's handleAddToCart) and re-enables
  // itself immediately — the actual add-to-cart server action
  // (addToCartBulk, in cart-context.tsx) runs asynchronously afterward.
  // Waiting on the button's enabled state (as an earlier version of this
  // helper did) doesn't wait for that request, so a `page.goto` right after
  // could race ahead of it and abort it mid-flight, leaving the cart empty.
  // Wait for the network to go idle so the request has actually completed.
  await page.waitForLoadState('networkidle');
}

test('cart page renders correctly with an item added', async ({ page }, testInfo) => {
  const countryCode = testInfo.project.name.split('-')[0];
  await addTestProductToCart(page, countryCode);
  await page.goto(`/${countryCode}/cart`);
  await expect(page.getByTestId('cart-container')).toBeVisible();
  // Confirms the cart actually has the item (not the empty-cart state) —
  // asserting container visibility alone doesn't distinguish the two.
  await expect(page.getByTestId('cart-item-subtotal')).toBeVisible();
  await waitForImagesToLoad(page);
  await expect(page).toHaveScreenshot(`cart-${testInfo.project.name}.png`, {
    fullPage: true,
  });
});
