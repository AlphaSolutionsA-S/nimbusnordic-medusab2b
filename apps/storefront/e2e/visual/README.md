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
| `E2E_NINTH_COUNTRY`, `E2E_NINTH_LOCALE` | Optional, default `nl` / `nl` |
| `E2E_BACKEND_NODE_ENV` | Optional, default `development`; set it to the backend's `NODE_ENV`. With `production` or `staging` the security case expects a `SameSite=Lax; Secure` session cookie and a 401 for the foreign form; otherwise no SameSite attribute and a 415 (Medusa sets SameSite only in production and staging) |

The journey runs once (project `gb-desktop`). Its fixture (`country-language-fixture.ts`) runs the
country-language bootstrap if the backend is not initialized, adds the ninth country to the first
region if needed, creates the ninth language from the English texts with every text prefixed
`[nl] `, activates it, and then assigns it in the Admin UI. Afterwards it reassigns the country,
deactivates a language it created and restores the region; the bootstrap and the created language
row stay. Use a local or disposable backend only. The journey waits up to six minutes for the
storefront to pick up the change (240-second snapshot freshness).
