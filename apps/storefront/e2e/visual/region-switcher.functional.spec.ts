import { expect, test } from '@playwright/test';

import { readPublication } from './country-language-fixture';

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
  await page.locator('header').getByTestId('region-switcher').selectOption(targetCountryCode);

  // The home route itself redirects unauthenticated visitors onward to
  // /account (src/app/[countryCode]/(main)/page.tsx) — that's a separate,
  // pre-existing gate unrelated to the switcher. What this test verifies is
  // that the switcher navigated to the *new region*, so both `/gb` and
  // `/gb/account` are acceptable outcomes here.
  await expect(page).toHaveURL(new RegExp(`/${targetCountryCode}(/account)?$`));
});

// Labels come from the backend's country-language publication (NIMBUS-176), not a storefront list.
test('region switcher labels each published country with its published language', async ({ page, request }, testInfo) => {
  test.skip(!process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY, 'needs NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY');
  const countryCode = testInfo.project.name.split('-')[0];
  const publication = await readPublication(request);
  const published = publication.countries.find((entry) => entry.country_code === countryCode);

  await page.goto(`/${countryCode}/store`);

  await expect(page.locator('html')).toHaveAttribute('lang', published?.locale ?? publication.default_locale);
  // The header's switcher: the footer renders a second one with the same test id.
  const switcher = page.locator('header').getByTestId('region-switcher');
  for (const entry of publication.countries) {
    await expect(switcher.locator(`option[value="${entry.country_code}"]`)).toContainText(`(${entry.locale})`);
  }
});
