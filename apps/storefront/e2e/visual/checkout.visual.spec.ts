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
  // could race ahead of it and abort it mid-flight — the checkout page then
  // 404s (no cart cookie was ever set) instead of rendering the checkout
  // form. Wait for the network to go idle so the request has completed.
  await page.waitForLoadState('networkidle');
}

// No seeded customer/company exists to test an authenticated checkout (see
// apps/backend's initial-data-seed.ts) — this covers the guest checkout
// state, which the checkout page renders directly (with a sign-in prompt
// alongside the shipping/contact form) rather than hard-redirecting.
test('checkout page renders correctly for a guest with a non-empty cart', async ({ page }, testInfo) => {
  const countryCode = testInfo.project.name.split('-')[0];
  await addTestProductToCart(page, countryCode);
  await page.goto(`/${countryCode}/checkout`);
  // Confirms the checkout page actually rendered the checkout form for a
  // real, found cart (not the generic not-found page, which a stale/missing
  // cart cookie would otherwise silently produce).
  await expect(page.getByTestId('cart-item-subtotal')).toBeVisible();
  await waitForImagesToLoad(page);
  await expect(page).toHaveScreenshot(`checkout-${testInfo.project.name}.png`, {
    fullPage: true,
  });
});
