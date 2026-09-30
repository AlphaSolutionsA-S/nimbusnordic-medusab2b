# NIMBUS-175 validation evidence

- **Date:** 2026-09-30
- **Branch:** `feature/NIMBUS-175`. Baseline is `8e7d8b8` (develop tip when the branch was cut);
  final results are from the implementation commits listed in `PROGRESS.md`.
- **Environment:** Windows 11, Node 24.14, pnpm 9.15 (`shamefully-hoist=true`), and a disposable
  PostgreSQL 18 container (`nimbus175_test_pg`, port 55432) created for this work. No shared or
  remote database was used, nothing was deployed, and no Medusa Cloud variables were read or
  changed. Integration tests kept the Business Central guard, with a dummy `TestDK` discovery URL
  and no BC credentials.

## Automated suites: baseline vs final

Compared by failing test and error, not only by count.

| Check | Baseline (`8e7d8b8`) | Final | New failures |
| --- | --- | --- | --- |
| Backend `tsc --noEmit` | 22 errors, all in `integration-tests/http/{business-central-order,order-ingestion,orderapi}` and `integration-tests/utils/admin.ts` | same 22 errors, same files | none |
| Backend `medusa lint` | 0 errors, 13 warnings | 0 errors, 13 warnings | none |
| Backend unit (`TEST_TYPE=unit`) | 141/141 | 248/248 | none |
| Backend modules (`integration:modules`) | 253 passed, 2 failed | 288 passed, 2 failed | none |
| Backend HTTP (`integration:http`) | 107 passed, 8 failed | 132 passed, 8 failed | none |
| Backend Admin UI (`jest.admin.config.js`, new) | — | 19/19 | — |
| Backend `medusa build` | not captured | backend and Admin build succeed | — |
| Storefront Jest | 362 passed, 3 failed | 429 passed, 3 failed | none |
| Storefront `tsc --noEmit` | 8 errors (`account-nav.test.tsx`, `profile-card`, `cart-drawer`) | same 8 | none |
| Storefront `next lint` | 0 errors, 2 warnings | 0 errors, 2 warnings | none |
| Storefront `next build` | fails without a reachable backend (`generateStaticParams`) | fails the same way without a backend; **succeeds** with the local backend and imported translations | — |

Unit and module counts include duplicates from the compiled `.medusa/server` copies, as in the
baseline.

Pre-existing failures, unchanged and not caused by this work:

- Modules: `BusinessCentralModuleService.listOrders › stops filling from salesInvoices after the
  round-trip guardrail even if the page stays short` (`TypeError: Cannot read properties of
  undefined (reading 'ok')`), plus its `.medusa/server` duplicate.
- HTTP: `quotes.spec.ts` and `admin/quotes/quotes.spec.ts` — 8 quote tests (`GET /store/quotes`,
  `GET /store/quotes/:id` ×2, `POST /store/quotes`, accept ×2, reject, `POST
  /admin/quotes/:id/messages`).
- Storefront Jest: `PageLayout › renders the extracted promo-banner copy unchanged`,
  `ProductTabs › renders the extracted specification labels/values unchanged`,
  `ProductTabs › renders the extracted tab labels unchanged`.

### Lockfile side effect found and fixed

Adding the Admin test dependencies with `pnpm add` also re-resolved `acorn` and
`@babel/code-frame`. With `shamefully-hoist`, that changed the root-hoisted `zod` from 3.25.76 to
4.2.0 and added a new storefront type error in `quote-messages.tsx`: `@hookform/resolvers` 3.10
takes its zod types from the hoisted copy. It does not import zod at runtime. Commit `fa917a3`
keeps only the pure lockfile additions. A frozen install then hoists zod 3.25.76 again, and the
storefront typecheck is back to the baseline 8 errors.

## Task-level tests added

- Task 01: `documents`, `validation` and `icu` unit specs (43 tests).
- Task 02: module spec (17 tests on real PostgreSQL): concurrent saves (one winner), simultaneous
  first imports, stale import/activation, parallel reports, caps across connections, a race
  between a report and a resolution, dismissal persistence, and stale outage reports.
- Task 03: HTTP spec (25 tests): admin/customer/anonymous access; publishable-key reads;
  `translation_inactive` versus `translation_not_found`; boundaries (prototype key, arrays,
  dotted keys, unknown fields, malformed JSON, oversized body, 51-report batch); secrets missing
  or wrong; deduplication; filled keys not recreated; resolution scoped to locale and outage
  sentinel; export round trip. Task 07 callback cases: requested, 5xx and a hanging callback
  (3-second timeout), each with a committed save and `refresh: "deferred"`.
- Tasks 04–05: Admin jsdom tests (19): save with version and full document, empty-group
  preservation, 409 keeps the draft, reference refetch keeps the draft, search across sections,
  loading/empty/error, ICU warnings do not block save, HTML-like text shown literally, first
  import without English, replace confirmation, stale-preview 409, merge adoption, language
  comparison, exact export, fill/dismiss endpoints, outage not fillable, dirty-work prompts,
  readiness for zero/some/all locales.
- Task 06: loader (TTL cache use, last-good after invalidation plus outage, cold raw keys, no
  cached failures, malformed responses, inactive tombstone clears the snapshot, absent row keeps
  it, watermark monotonicity), error handlers, request config, provider, and dk/se layout mapping.
- Task 07: revalidate route (secret, validation, size, out-of-order callbacks), public missing
  route (origin, content type, locale, batch, streamed-size limit, global and per-client rate
  limits, outage, path sanitizing), browser queue (batch, dedup, bound, pagehide, no retries),
  server reporter (after(), dedup, typed outage, no recursion, missing secret), and the
  middleware pathname header.

## Migration (Task 02 TC-6 / Task 08 TC-5)

Generated with `medusa db:generate storefrontTranslation` (`Migration20260930183236`). On the
disposable database `nimbus175_gen`:

- `db:migrate` applied it with 0 rows in `storefront_translation`.
- `db:rollback storefrontTranslation` dropped both tables.
- `db:migrate` again recreated them.
- A duplicate live locale was rejected by `IDX_storefront_translation_locale_unique`; a
  soft-deleted duplicate was allowed.

A full `db:migrate` (with the existing seed scripts) on `nimbus175_e2e` also left
`storefront_translation` empty.

## Production-mode checks (Task 08)

Setup: backend `medusa develop` on `localhost:9000` against `nimbus175_e2e`. Storefront `next build`
(production) served by **two independent instances**:

- **A** on :8000, from the app directory. It receives the backend callback.
- **B** on :8001, from a copy of the build without `.next/cache`, so it has its own Data Cache and
  process memory, like a second worker or container.

Probes requested `/{country}/cart` with a cache-id cookie and read `<title>` (the `Metadata.cart`
texts).

### TC-1 First environment and editing — passed

- All 8 source files previewed as 588 added, 0 removed, then imported (201, inactive, version 1)
  and activated (version 2).
- `it` has one placeholder warning: `Checkout.review.agreementText` is missing the
  `<privacyLink>`/`<termsLink>` tags. This is a content issue in `it.json`, reported but not fixed.
- dk→"Kurv", gb→"Cart", se→"Varukorg" on both instances. The `messages/*.json` files were not
  modified.
- An Admin save of `da` returned `refresh: "requested"`. A showed the new value on the next
  request; B still showed the old one (see TC-3).
- Copying `nl` from `en` created it inactive (version 1); `GET /store/ui-translations/nl` returned
  404 `translation_inactive`.
- **Finding:** exports are equal to the source files by content (`isDeepStrictEqual`), but not
  byte-for-byte. PostgreSQL `jsonb` reorders object keys (shorter keys first), so exported key
  order and the Admin section-tab order differ from the source file. The scope requires
  "equivalent" export, and there is no data loss. Changing this would need a `json` column
  instead of `model.json()` (`jsonb`); that is left for review.

### TC-2 Conflicts and imports — passed (API level)

- Two concurrent saves at the same version returned 200 and 409; the version became 2 with one
  writer's document.
- A stale import and a stale activation each returned 409.
- A replace preview listed 559 removals. Applying without confirmation returned 400; with
  confirmation, 200.
- A save containing malformed ICU (`Hallo {naam`) returned 200 with an `invalid_icu` warning.
- **Finding:** Medusa's error handler replaces the CONFLICT message with its generic
  "…retry the request with the provided Idempotency-Key." The Admin UI does not show that text; it
  maps 409 to its own conflict panel and messages.
- Retaining work in two browser contexts is covered by the jsdom tests, not by a real browser
  (see Not verified).

### TC-3 Warm/cold caches, invalidation, multiple workers — passed

| Step | Result |
| --- | --- |
| A warm on `da` v4; backend stopped; signed callback (v5) invalidated A's tag | A served its **last-good copy** ("Kurv (v4)") |
| B during the outage, `da` still in its Data Cache | served its cached copy |
| B during the outage, `pl` never loaded (cold) | rendered the **raw key** `Metadata.cart.title`; one `locale_unavailable` report; the failed forward was logged by status only, with no recursion |
| Backend restarted | A read fresh data; B recovered `pl` on the next request (failures are not cached) |
| Lost callback on B (`da` v2 cached 21:43:12) | 21:48:38: stale served and a background refresh triggered; 21:48:41: "Kurv (v4)". Cross-worker latency ≤ 300 s plus one request |
| Deactivate `fr` | A showed raw keys immediately; B (cold for `fr`) cached an `inactive` tombstone |
| Reactivate `fr` | A showed "Panier" immediately. A replayed old callback (v3, inactive) returned `{"revalidated":false,"reason":"outdated"}` and A stayed active |
| B after its tombstone TTL | first request stale, next request "Panier": the tombstone is replaced, not kept forever |
| No file or English fallback | in every failure branch the page showed the last good copy of the same language or raw keys, never English text |

Pages returned HTTP 500 while the backend was down. The cause is the storefront's other data
loaders (`lib/util/medusa-error`: "Error setting up the request: fetch failed"), not
translations; the translated `<title>` still rendered. A freshly started instance cannot serve
any page during a full backend outage, because middleware must fetch regions. That is
pre-existing behaviour and is noted as a limit on "cold instance renders keys": the raw-key cold
path was shown with the backend up and a cold locale.

### TC-4 Missing-key inbox and abuse controls — passed

- Removing `Metadata.cart.title` from `de` by confirmed replace, then rendering `/de/cart?session=secret123`
  three times, produced **one** entry (count 1, path `/de/cart`, query stripped). The raw key
  rendered.
- Deactivated `it`: two renders produced one `__locale_unavailable__` notice. Reactivation cleared
  it.
- Resolving the German entry to "Warenkorb (gefüllt)": the storefront showed it at once and the
  entry was removed. A dismissed entry stayed dismissed.
- Public `/api/translations/missing`:
  - forged origin: 403; `text/plain`: 415; 40 KB body: 413; unsupported locale: 400;
  - a valid report was stored with path `/dk/account/orders/details/[id]`;
  - a 310-request storm: 300 accepted in the minute window (including 3 earlier requests), then 429.
- `.next/static` and `.next/server` contain neither secret value.
- **Finding, fixed in this branch:** a worker still holding an inactive tombstone reported
  `locale_unavailable` for `fr` after it was reactivated, which left a stale notice. The backend
  now ignores outage reports for locales that are active (module test added).

### TC-5 Metadata, 404, schema, regression — passed, with gaps below

- Localized titles as above. `/dk/no-such-page` gave 404 "Siden blev ikke fundet"; root 404
  `/assets/no-such-file` gave 404 "Page not found" (default locale, same loader).
- `/dk/store`, a product page and `/se/account` rendered with no raw keys. `/gb/checkout` without
  a cart gave 404, as before.
- The production build route table still prerenders the SSG routes (●).

## Not verified / limitations

1. **Admin browser smoke test (keyboard, 600 fields).** Under `medusa develop`, *every* Admin page
   crashed in Edge, including the built-in `/app/orders`, with "Objects are not valid as a React
   child ({$$typeof, type, key, props, _owner, _store})". The crash persists with the new
   Translations route removed. Root-hoisted `@medusajs/icons` is the React 19 variant under the
   baseline lockfile too, which likely causes it. This is pre-existing and not investigated
   further. The Admin UI is covered by the 19 jsdom tests only; the production Admin bundle
   (`medusa build`) compiles, but was not run in a browser.
2. **Browser-originated missing-key reports** were exercised with unit tests and direct HTTP
   calls to the public route, not from a real browser page.
3. **Storefront checkout/navigation regression** is limited to the page probes above. The
   Playwright visual suite was not run: the pinned browsers are not installed, and no snapshot
   updates were wanted.
4. **Hosted behaviour** was not tested: HTTPS callback, proxy client-IP header, replica counts
   and Medusa Cloud caching. That needs the per-environment rollout in `ROLLOUT.md`.
5. The timed-refresh latency was measured on one host with two instances. Real latency depends on
   traffic, because the refresh is request-driven.
