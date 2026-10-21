import { expect, test } from '@playwright/test';

import {
  BACKEND_IS_PRODUCTION_LIKE,
  BACKEND_URL,
  FixtureState,
  loginAdmin,
  missingFixtureEnvironment,
  NINTH_LOCALE,
  NINTH_TEXT_MARKER,
  prepareFixture,
  readManagement,
  readPublication,
  restoreFixture,
} from './country-language-fixture';

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

// One end-to-end run against a real backend (NIMBUS-176): it changes backend data, so it runs in a
// single project and serially, and never retries (a retry starts from the data the first attempt
// left behind, not from the original state).
test.describe('a ninth language assigned in Admin', () => {
  test.describe.configure({ mode: 'serial', retries: 0 });

  let fixture: FixtureState | null = null;

  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'gb-desktop', 'runs once, in gb-desktop');
    const missing = missingFixtureEnvironment();
    test.skip(missing !== null, missing ?? '');
  });

  test.afterAll(async ({ browser }) => {
    if (!fixture) {
      return;
    }
    const context = await browser.newContext();
    await loginAdmin(context.request);
    await restoreFixture(context.request, fixture);
    await context.close();
  });

  test('reaches language, texts, formatting, switcher and alternate links', async ({ page, context }, testInfo) => {
    // The storefront converges within five minutes (240 s snapshot freshness plus a bounded read).
    test.setTimeout(8 * 60_000);
    await loginAdmin(context.request);
    fixture = await prepareFixture(context.request, testInfo);
    const { countryCode } = fixture;

    // The real Admin journey: Translations → edit the country → pick the language → save.
    await page.goto(`${BACKEND_URL}/app/translations`);
    await page.getByRole('button', { name: `Edit language for ${countryCode}` }).click();
    await page.getByRole('combobox', { name: 'Storefront language' }).click();
    await page.getByRole('option', { name: NINTH_LOCALE, exact: true }).click();
    await page.getByRole('button', { name: 'Save language' }).click();
    await expect(page.getByLabel(`${countryCode}: ${NINTH_LOCALE} (set explicitly)`)).toBeVisible();

    const management = await readManagement(context.request);
    expect(management.countries).toContainEqual({
      country_code: countryCode,
      locale: NINTH_LOCALE,
      source: 'explicit',
      configured: true,
    });
    const publication = await readPublication(context.request);
    expect(publication.countries).toContainEqual({
      country_code: countryCode,
      locale: NINTH_LOCALE,
      source: 'explicit',
    });
    await testInfo.attach('admin-country-languages.json', {
      body: JSON.stringify(management, null, 2),
      contentType: 'application/json',
    });
    await testInfo.attach('store-country-languages.json', {
      body: JSON.stringify(publication, null, 2),
      contentType: 'application/json',
    });

    const shopper = await context.newPage();
    await expect(async () => {
      await shopper.goto(`/${countryCode}/store`);
      await expect(shopper.locator('html')).toHaveAttribute('lang', NINTH_LOCALE);
    }).toPass({ timeout: 6 * 60_000, intervals: [10_000] });

    // Texts come from the ninth language (the fixture marks every copied text).
    await expect(shopper.locator('body')).toContainText(NINTH_TEXT_MARKER);
    // Prices use the language's number format (decimal comma for nl) in the region's currency.
    const decimal = new Intl.NumberFormat(NINTH_LOCALE)
      .formatToParts(1.5)
      .find((part) => part.type === 'decimal')?.value;
    const price = await shopper.getByTestId('price').first().innerText();
    expect(price).toMatch(new RegExp(`\\d\\${decimal}\\d{2}`));
    // The switcher labels every published country with its published language. The header's
    // switcher: the footer renders a second one with the same test id.
    const switcher = shopper.locator('header').getByTestId('region-switcher');
    await expect(switcher).toHaveValue(countryCode);
    for (const entry of publication.countries) {
      await expect(switcher.locator(`option[value="${entry.country_code}"]`)).toContainText(`(${entry.locale})`);
    }

    await shopper.locator('a[href*="/products/"]').first().click();
    await expect(shopper).toHaveURL(new RegExp(`/${countryCode}/products/`));
    const productPath = new URL(shopper.url()).pathname.replace(`/${countryCode}`, '');
    const alternates = await shopper
      .locator('head link[rel="alternate"][hreflang]')
      .evaluateAll((links) =>
        links.map((link) => ({ hreflang: link.getAttribute('hreflang'), href: link.getAttribute('href') }))
      );
    await testInfo.attach('product-head.html', {
      body: await shopper.locator('head').innerHTML(),
      contentType: 'text/html',
    });
    await testInfo.attach('product-page.png', { body: await shopper.screenshot(), contentType: 'image/png' });

    // One alternate per published country, each with its own key; countries that share a
    // language keep their URLs.
    expect(alternates).toHaveLength(publication.countries.length);
    expect(new Set(alternates.map((link) => link.hreflang)).size).toBe(publication.countries.length);
    for (const entry of publication.countries) {
      const link = alternates.find((candidate) => candidate.href?.endsWith(`/${entry.country_code}${productPath}`));
      expect(link?.hreflang, `alternate for ${entry.country_code}`).toMatch(
        new RegExp(`-${entry.country_code.toUpperCase()}(-|$)`)
      );
    }
    expect(alternates).toContainEqual({
      hreflang: `${NINTH_LOCALE}-${countryCode.toUpperCase()}`,
      href: expect.stringMatching(new RegExp(`/${countryCode}${productPath}$`)),
    });
  });

  // What this proves depends on the backend's NODE_ENV (E2E_BACKEND_NODE_ENV, see the fixture):
  // - production or staging: the session cookie is sent as `SameSite=Lax; Secure`, so the browser
  //   withholds it from the foreign form POST and the route answers 401.
  // - anything else (a local development backend): Medusa sets no SameSite attribute and Chromium
  //   treats the cookie as Lax by default. Observed in this suite's Chromium: the cookie, set by an
  //   API-context login, was withheld from the form POST (401). A browser that still sends a cookie
  //   younger than two minutes on a top-level cross-site POST delivers it, and the strict-JSON check
  //   refuses the text/plain body (415). Either is accepted; the report attaches which one happened.
  // In both, the credentialed JSON fetch is blocked by the CORS preflight and nothing is stored.
  test('a foreign page cannot change the assignment with the Admin session', async ({ page, context }, testInfo) => {
    const setCookie = await loginAdmin(context.request);
    expect(setCookie, 'Set-Cookie of the session cookie').toBeDefined();
    if (BACKEND_IS_PRODUCTION_LIKE) {
      expect(setCookie).toMatch(/;\s*SameSite=Lax(;|$)/i);
      expect(setCookie).toMatch(/;\s*Secure(;|$)/i);
    } else {
      expect(setCookie).not.toMatch(/;\s*SameSite=/i);
    }

    const before = await readManagement(context.request);
    const target = before.countries.find((entry) => entry.configured);
    expect(target, 'a country in a region to try to reassign').toBeDefined();
    const otherLocale = before.active_locales.find((locale) => locale !== target?.locale);
    expect(otherLocale, 'a second active language to try to assign').toBeDefined();
    const endpoint = `${BACKEND_URL}/admin/country-languages/${target?.country_code}`;

    // A page on another site, served by the browser itself.
    await page.route('http://attacker.example/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<form method="post" action="${endpoint}" enctype="text/plain">
          <input name='{"locale":"${otherLocale}","expected_version":${before.version},"x":"' value='"}'>
          </form>`,
      })
    );
    await page.goto('http://attacker.example/');

    const fetchOutcome = await page.evaluate(
      async ({ url, body }) => {
        try {
          const response = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body,
          });
          return `status ${response.status}`;
        } catch {
          return 'blocked';
        }
      },
      { url: endpoint, body: JSON.stringify({ locale: otherLocale, expected_version: before.version }) }
    );
    // The JSON request needs a CORS preflight, which the backend does not grant this origin.
    expect(fetchOutcome).toBe('blocked');

    const formResponse = page.waitForResponse((response) => response.url() === endpoint);
    await page.locator('form').evaluate((form: HTMLFormElement) => form.submit());
    // 401: the session cookie was withheld; 415: it was sent and the text/plain body was refused.
    const formStatus = (await formResponse).status();
    const formOutcome = new Map([
      [401, 'session cookie withheld'],
      [415, 'session cookie sent, non-JSON body refused'],
    ]).get(formStatus);
    await testInfo.attach('foreign-form-status.txt', {
      body: `${formStatus}: ${formOutcome ?? 'unexpected'}`,
      contentType: 'text/plain',
    });
    // Soft, so the unchanged-document checks below always run.
    if (BACKEND_IS_PRODUCTION_LIKE) {
      expect.soft(formStatus, 'foreign form status').toBe(401);
    } else {
      expect.soft([401, 415], 'foreign form status').toContain(formStatus);
    }

    const after = await readManagement(context.request);
    expect(after.version).toBe(before.version);
    expect(after.countries).toEqual(before.countries);
  });
});
