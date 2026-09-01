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
