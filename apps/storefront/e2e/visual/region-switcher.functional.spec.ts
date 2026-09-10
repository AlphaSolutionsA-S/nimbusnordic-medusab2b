import { expect, test } from '@playwright/test';

const OTHER_REGION_BY_STARTING_COUNTRY: Record<string, string> = {
  dk: 'gb',
  gb: 'dk',
  se: 'gb',
  no: 'gb',
  pl: 'gb',
  it: 'gb',
  fr: 'gb',
  de: 'gb',
};

// Uses a `data-testid` rather than `getByLabel` because the switcher's
// aria-label is translated per locale (NIMBUS-165/167) — a locale-independent
// selector is required for this test to run consistently across all 8 locales.
test('region switcher navigates to the selected region homepage', async ({ page }, testInfo) => {
  const countryCode = testInfo.project.name.split('-')[0];
  const targetCountryCode = OTHER_REGION_BY_STARTING_COUNTRY[countryCode];

  await page.goto(`/${countryCode}`);
  await page.getByTestId('region-switcher').selectOption(targetCountryCode);

  // The home route itself redirects unauthenticated visitors onward to
  // /account (src/app/[countryCode]/(main)/page.tsx) — that's a separate,
  // pre-existing gate unrelated to the switcher. What this test verifies is
  // that the switcher navigated to the *new region*, so both `/gb` and
  // `/gb/account` are acceptable outcomes here.
  await expect(page).toHaveURL(new RegExp(`/${targetCountryCode}(/account)?$`));
});
