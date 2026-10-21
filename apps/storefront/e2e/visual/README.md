# Visual & functional regression suite

Playwright suite covering 8 locales x 2 viewports (desktop/mobile) = 16 projects, run via:

```
pnpm test:visual          # run the suite
pnpm test:visual:update   # (re)generate baseline screenshots
```

## Operational prerequisite

This suite requires a **running Medusa backend with the 8 target regions/countries seeded**
(per NIMBUS-164) and the storefront dev server, since it renders and screenshots real pages
(home, PLP, PDP, cart, checkout, account) — it cannot run in isolation the way the Jest unit
suite can. `playwright.config.ts`'s `webServer` boots the storefront (`pnpm dev`) automatically,
but the Medusa backend (with its database) must already be running and seeded separately.

Spec files are kept out of `src/__tests__/` and are not picked up by `jest.config.ts`
(`testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}']`), since Playwright specs are not
jsdom-compatible.

## Country-language journeys (NIMBUS-176)

`locale-links.functional.spec.ts` ("a ninth language assigned in Admin") and the label check in
`region-switcher.functional.spec.ts` read and change a real backend. They are skipped, with the
reason in the report, unless these are set in the shell that runs Playwright:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Reads `GET /store/country-languages` (both specs) |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | An Admin user; the journey logs in through the real auth routes |
| `E2E_BACKEND_URL` | Optional, default `http://localhost:9000` |
| `E2E_NINTH_COUNTRY` | Optional: the journey's country. It must already be in a region when the storefront starts and must not be a project country (`dk gb se no pl it fr de`). Default: the first other country in a region on the default language |
| `E2E_NINTH_LOCALE` | Optional, default `nl` |
| `E2E_BACKEND_NODE_ENV` | Optional, default `development`; set it to the backend's `NODE_ENV`. With `production` or `staging` the security case expects a `SameSite=Lax; Secure` session cookie and a 401 for the foreign form. Otherwise it expects no SameSite attribute (Medusa sets SameSite only in production and staging) and accepts 401 or 415 for the foreign form: this suite's Chromium withheld the cookie (401); a browser that sends it gets 415 (the strict-JSON check). The report attaches which one happened |

The journey runs once (project `gb-desktop`), without retries: it changes data, so a retry would
start from what the first attempt left. Its fixture (`country-language-fixture.ts`) runs the
country-language bootstrap if the backend is not initialized, picks the journey's country (never a
project country, whose texts the parallel project tests read; the list is `project-locales.ts`,
shared with `playwright.config.ts`), creates
the ninth language from the English texts with every text prefixed `[nl] ` if it does not exist,
activates it if needed, and then assigns it in the Admin UI. It never changes regions: storefront
middleware caches the region map for an hour, so a country added to a region during the run is not
routed as that country. Afterwards it reassigns the country to its previous language (a country that
was on the default language keeps an explicit entry for it, since the API cannot remove an entry; the
next run can pick it again, because the choice accepts an explicit entry on the default language) and
deactivates the language if it activated it; the bootstrap and the created language row stay. Use a
local or disposable backend only. The journey waits up to six minutes for the
storefront to pick up the change (240-second snapshot freshness). The region switcher's label test
runs the same bootstrap when the backend is not initialized, so it does not depend on test order. It
checks only the project countries' labels: the journey changes another country in parallel, and the
storefront can show that change up to 240 seconds after the publication does.
