import { expect, test } from '@playwright/test';
import { waitForImagesToLoad } from './utils';

// Real seeded product handle (see apps/backend's seeded catalog via `/store/products`).
const TEST_PRODUCT_HANDLE = '1080p-hd-pro-webcam-superior-video-privacy-enabled';

test('product detail page renders correctly', async ({ page }, testInfo) => {
  const countryCode = testInfo.project.name.split('-')[0];
  await page.goto(`/${countryCode}/products/${TEST_PRODUCT_HANDLE}`);
  await expect(page.getByTestId('product-container')).toBeVisible();
  await waitForImagesToLoad(page);
  await expect(page).toHaveScreenshot(`pdp-${testInfo.project.name}.png`, {
    fullPage: true,
  });
});
