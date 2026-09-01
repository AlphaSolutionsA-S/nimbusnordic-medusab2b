import { expect, test } from '@playwright/test';

// Infrastructure smoke test for the Playwright visual-regression setup
// (NIMBUS-169 Task 01). Confirms the webServer boots and the project matrix
// (8 locales x 2 viewports) resolves a real locale route, independent of any
// specific flow's content.
test('locale homepage loads', async ({ page }, testInfo) => {
  const countryCode = testInfo.project.name.split('-')[0];
  await page.goto(`/${countryCode}`);
  // Unauthenticated visitors are redirected to /account (see
  // src/app/[countryCode]/(main)/page.tsx) — confirms the route resolves
  // successfully rather than erroring, independent of auth state.
  await expect(page).toHaveURL(new RegExp(`/${countryCode}/account$`));
});
