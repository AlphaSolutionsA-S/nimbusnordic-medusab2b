import { expect, test } from '@playwright/test';
import { waitForImagesToLoad } from './utils';

test('product listing page renders correctly', async ({ page }, testInfo) => {
  const countryCode = testInfo.project.name.split('-')[0];
  await page.goto(`/${countryCode}/store`);
  await expect(page.getByTestId('category-container')).toBeVisible();
  await waitForImagesToLoad(page);
  await expect(page).toHaveScreenshot(`plp-${testInfo.project.name}.png`, {
    fullPage: true,
  });
});
