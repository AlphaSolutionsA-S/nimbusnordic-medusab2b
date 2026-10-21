# Deviation report: NIMBUS-176 Manage country languages from Admin

> Record of NIMBUS-176, frozen when the work shipped. Not maintained: the code and docs/architecture/ describe current behaviour.

Branch `feature/NIMBUS-176`, merge-base `9f4a0cf`, commits c006f03 (NIMBUS-194), 71b8e50 (NIMBUS-195),
eef094e (NIMBUS-196), 57adbf2 (NIMBUS-197), 0079b98 (NIMBUS-198), 6bc31f9 (consolidation).
Reviewed against PLAN.md, SCOPE.md, branch-notes.md and task files 01–05 on 2026-10-21.

## Deviations from scope and plan

None of these blocks the branch. None is a hand-written migration: `Migration20261020125711` and the
snapshot were generated.

- 01: Real-PG specs run with `test:integration:modules`, not the manifest's `test:unit`. Acceptable:
  that is the command for module specs.
- 01: `CountryLanguageConfiguration` is left out of `MedusaService({...})` on purpose, so no generated
  CRUD can bypass the CAS and the lock. All reads and writes are raw SQL in the owning service.
  Acceptable, and it strengthens the integrity property.
- 01: The service has more methods than the seam listed (`getCountryLanguageConfiguration`,
  `previewCountryLanguageBootstrap`, `getCountryLanguageManagement`, `publishCountryLanguages`).
  Acceptable. `getCountryLanguageConfiguration` has only test callers (see Findings).
- 01: Error types: CONFLICT for stale, uninitialized, inactive, English or referenced deactivation and
  a busy lock; INVALID_DATA for malformed input or an unconfigured country; UNEXPECTED_STATE mapped to
  503. Acceptable and matches the plan's status codes.
- 01: Running bootstrap against an existing document returns `{created:false}` instead of failing, so
  the script is idempotent. Acceptable.
- 01: Only one document can exist because it has a fixed primary key and is written under the
  configuration lock. There is no "one row" check constraint (a generated migration cannot express
  one). Acceptable.
- 02: `lockConfiguration` now restores the caller's `lock_timeout` after taking the lock (it used to
  leak into the rest of the transaction). Fixed in 02 and covered by a module spec. Acceptable.
- 02: Every `ui-translations` mutation now returns the domain's 409 message instead of the
  framework's generic retry text. The status and body shape are unchanged. Acceptable; Admin UI
  consumers were updated (`conflictAwareErrorMessage`).
- 02: The activation route now accepts only a session, only JSON, and at most 1 KiB, so bearer-token
  callers get 401. This changes behaviour for any external caller. Acceptable per the security
  matrix, but see Open question 4.
- 02: The legacy country map was copied into the backend bootstrap script (`bound-app-isolation`).
  Acceptable. It is the second copy of the legacy map besides the storefront's cold fallback.
- 02: Session expiry was not simulated separately (a forged cookie, an unknown session and a
  logged-out cookie stand in for it). There is no MFA test because the test environment has no MFA
  provider; the framework default was verified from dist. Acceptable, recorded.
- 03: The language picker is a plain `Select`, not the searchable table selection the plan describes
  for larger lists. Acceptable while there are about 10 or fewer active languages.
- 03: An Admin can save a default-source country explicitly as `en`, which turns it into an explicit
  entry. Acceptable; it adds no rule.
- 04: `getCountryLanguageForCountry` returns `{locale, availability}` rather than a bare locale.
  Acceptable.
- 04: The loader keeps its state in process memory with `cache: "no-store"` instead of
  `unstable_cache`, so nothing survives a restart, as the plan requires. Acceptable. See Findings
  item 1 for how this behaves during `next build`.
- 04: Middleware forwards the country only when the first path segment matches exactly (the old code
  used `includes`). Acceptable; it closes a mismatch between layout and request config.
- 04: The loader does not check response byte size; the response shape plus the limit of 676 entries
  and 64-character tags bound it. Acceptable.
- 05: hreflang keys for the original eight countries change from bare `da` to `da-DK` (and so on).
  This is user-visible for SEO and was intended by the plan's alternate-link decision. Acceptable.
- 05: `getFormattingLocale("xx")` now returns `xx` instead of `en-GB` (valid tags use Intl's
  fallback). This matches the plan's decision.
- 05: The Playwright ninth-language journey, the switcher label check and the browser CSRF case were
  written but **not run**. The plan's "Blocking, implementation verification" gate is therefore not
  fully met (Open question 1).
- 05: The browser security case expects 415 against a development backend (no SameSite attribute)
  and a 401 cookie-withheld response only against a production or staging `NODE_ENV`. Acceptable;
  see Open question 5.

## Consolidation changes

- Merged the duplicated storefront `errorStatus` helper into `apps/storefront/src/lib/util/error-status.ts`
  (used by `lib/data/ui-translations.ts` and `lib/data/country-languages.ts`).
- Deleted the unused `apps/storefront/src/modules/layout/templates/index.tsx`.
- Removed `export` from names used only in their own file: backend `respondToWorkflowError`,
  `sortAssignments`, `MAX_COUNTRY_ASSIGNMENTS`, `LEGACY_COUNTRY_LANGUAGES`; storefront
  `MAX_PUBLISHED_COUNTRIES`, `COUNTRY_LANGUAGES_MAX_AGE_MS`, `COUNTRY_LANGUAGES_READ_TIMEOUT_MS`,
  `COUNTRY_LANGUAGES_RETRY_MS`.
- Removed plan ids from the test names this branch rewrote. Older test names (pre-existing
  `TC-1`, `TC-2`, `TC-3`) still carry them. No added source or comment line cites a plan id
  (checked across the diff).
- Left for the human:
  - The `^[a-z]{2}$` check exists twice: `api/admin/country-languages/validators.ts`
    (`CountryCodeSchema`) and `modules/storefront-translation/country-languages.ts` (`isCountryCode`).
  - `getCountryLanguageConfiguration()` has only test callers.
  - The region-switcher option loop is duplicated in nav and footer (pre-existing).
  - The `e2e/visual/README.md` `webServer` line is stale.

## Findings

1. **Build-time legacy fallback (the specific concern): mechanical, low severity. Not a design
   finding: cached pages do not keep the legacy snapshot.**
   - **Cause.** In `apps/storefront/src/lib/data/country-languages.ts:61-72`, during `next build`
     static generation, the `cache: "no-store"` fetch inside `readPublication`
     (`country-languages.ts:29-33`) makes Next mark the scope as dynamic. Next sets
     `revalidate = 0` on the prerender store and throws `DynamicServerError` before any request is
     sent. Source: `next@15.5.18/dist/server/app-render/dynamic-rendering.js:179-235`,
     `markCurrentScopeAsDynamic`, case `prerender-legacy`. The loader's `catch` swallows that error.
     It logs `status: null` (the error has no HTTP status), sets `retryAt`, and returns the legacy
     snapshot for that throw-away render.
   - **Evidence that the fetch never left the process.** `backend-dev2.txt` (the backend running
     during `post-storefront-build`) shows about 500 `/store/*` requests from the build (regions,
     products, collections) and no `GET /store/country-languages`.
   - **Evidence that nothing was cached.** Because `revalidate = 0` is set before the throw, Next
     still bails the routes out of static generation even though the error is caught.
     - `apps/storefront/.next/prerender-manifest.json` from that build lists only
       `/opengraph-image.jpg` and `/twitter-image.jpg`.
     - `dynamicRoutes` is empty.
     - `.next/server/app/no/{products,collections,categories}/` hold no HTML.
     - No `[countryCode]` route exports `revalidate` or `dynamic`; the three SSG-looking routes
       export only `dynamicParams = true` plus `generateStaticParams`.
     - The build table's ● marks reflect `generateStaticParams`, not stored output.
     - At runtime every `[countryCode]` page renders on demand. Layouts, `generateMetadata`,
       `setRequestLocale` and alternates read the live per-worker snapshot, so the 240 s freshness
       behind the five-minute convergence (Flow D, B7) holds.
   - **Residual risk.** The design only works because a swallowed Next control-flow error still
     tags the route. If someone later adds `export const revalidate = N` (ISR) to a `[countryCode]`
     route, a regeneration could bake whatever snapshot that render saw, and the build would show a
     legacy render.
   - **Fix (one line, not blocking).** Call `unstable_rethrow(error)` (from `next/navigation`) at
     the top of the loader's `catch`. Builds then stop logging false failures, and Next's dynamic
     bailout stays explicit. `request.ts`'s `requestContext` has the same pre-existing pattern
     around `headers()`. See Open question 3.
2. **Low: Region membership is read outside the configuration lock.**
   `workflows/storefront-translation/workflows/assign-country-language.ts:583-590`. If a country is
   removed from its region between `listConfiguredCountryCodesStep` and the locked save, a new key
   can still be created for it. It then becomes a retained entry, which the approved rule handles.
   No integrity invariant is affected. Accept.
3. **Low: one rule spread over several copies of the legacy map and locale check.**
   - The legacy country map exists in `apps/backend/src/scripts/bootstrap-country-languages.ts` and
     in `apps/storefront/src/lib/i18n/country-language-map.ts`. This is required by app isolation
     and is registered in `decisions.md`.
   - Canonical-locale checks now exist in `S/lib/i18n/country-language-map.ts` (`isCanonicalLocale`),
     `S/app/api/translations/revalidate/route.ts` (`canonicalLocale`, pre-existing) and the backend
     `canonicalizeLocale`. The two storefront copies could share one helper.
   - Not a business-rule duplicate (it is validation). Note only.
4. **Low: dead or test-only exports.**
   - Backend: `getCountryLanguageConfiguration` (service), `RegionCountriesRow`, and
     `countryLanguageQueryKey`, which is used only inside `admin/hooks/api/ui-translations.tsx` and
     its tests.
   - Storefront: `COUNTRY_LANGUAGE_MAP` and `DEFAULT_LOCALE` are imported only by
     `__tests__/lib/i18n/country-language-map.test.ts`; `CountryLanguageVerdict` and
     `CountryLanguageSource` have no importer.
   - Harmless. Remove at the human's discretion.
5. **Info: `<html lang>` is set on the client only.** `HtmlLangSync`, from NIMBUS-169, is
   pre-existing; the root layout has no `lang` attribute. So the "rendered document language" check
   in Verify after deploy must be read in a browser after hydration, not from raw server HTML.
   Crawlers see the provider locale only through hreflang and the text.
6. **Info: edge case where request config and layout can disagree.** On a first visit without the
   `_medusa_cache_id` cookie, to a path that contains a `.` under `/{country}/` (for example a
   product handle with a dot), middleware takes the static-asset branch and forwards no country
   header. The request config then resolves the default language while the layout uses the URL
   country's language. The old code skipped the locale header on the same branch, so this predates
   the branch. Note only.

Checks with no finding:
- **Layers and boundaries:**
  - Routes call only workflows through `sendWorkflowResult`; their bodies are 7–24 lines, and the
    only `if` validates the path format.
  - Steps resolve the module service only through the container.
  - `utils/country-language-scope.ts` is pure; its import of `isCountryCode` is not from
    `service.ts`.
  - No `as unknown as`, `as any`, `eslint-disable` or `@ts-ignore` was added.
  - The Region read is a commented narrow exemption.
  - No cross-app imports.
  - The S4 nav and footer get the publication as props and import only pure lookups.
- **Data model:**
  - Only the owning service writes `country_language_configuration`: bootstrap inserts, and the
    assignment save updates under the lock and CAS.
  - The version increments only on accepted saves.
  - Retained keys are never deleted automatically, as the plan says. There is no deletion
    mechanism because the plan retains them indefinitely.
  - `data-ownership.md` lists the table.
- **State table:**
  - English deactivation is refused.
  - A referenced language (configured or retained) cannot be deactivated, and the refusal lists the
    sorted countries.
  - `activate` is the only path that changes `is_active`, and it takes the configuration lock
    before the locale lock (`service.ts` `mutateDocument_`).
  - An uninitialized configuration, or a broken active-language invariant, makes publication fail
    closed with 503.
  - Ordered races in both directions, plus an independent-instance race, are covered in
    `country-language-configuration.spec.ts`.
- **Security matrix:**
  - `requireAdminSession = authenticate("user", ["session"])` guards both Admin routes and
    activation.
  - `requireJsonBody` returns 415 and the bodies are limited to 1 KiB.
  - The public DTO is exact on both sides: the storefront parser rejects any extra key.
  - `Cache-Control: no-store` is set on 200, 409 and 503 responses.
  - The 503 message is generic.
  - `security-boundaries.spec.ts` covers anonymous access, publishable key, customer token and
    session, secret key, bearer-only, a spoofed actor, forged and logged-out cookies, form/text bodies,
    foreign preflight, and leak checks.
  - The real-browser foreign-origin case is written but not run.
- **Cross-app contract:**
  - Backend `GET /store/country-languages` returns exactly `{default_locale, countries[{country_code,
    locale, source}]}`, and `parseCountryLanguagePublication` requires exactly those keys.
  - The Admin hooks match the management DTO.
  - No URL is hard-coded between apps (the e2e default `localhost:9000` is overridable by an
    environment variable).
- **Whole-branch checks:** no new module (the existing one is extended). The new store route is
  public by design, so `ensure-role` does not apply. The Admin uses English literals as the existing
  Admin does; no storefront UI text was added. No new client environment variables.
- **Stale references:** no `getLocaleForCountry`, `SUPPORTED_LOCALES` or `Locale` remains. The
  remaining `X-NEXT-INTL-LOCALE` mentions describe its deletion. `lib/i18n/README.md`, Tier 0
  `layers.md`, `boundaries.md`, `decisions.md`, `data-ownership.md`, both storefront skill
  `project.md` files and the new `docs/architecture/country-languages.md` are current. The one
  stale item is the `e2e/visual/README.md` `webServer` line (pre-existing).

## Tests

- **Line counts in `apps/`:** tests +2715/−117, source +1637/−166. The volume follows from real-PG
  race specs, HTTP auth negatives across three routes, and loader timing cases. There is no target
  ratio.
- **No duplicated layers seen.** Module specs prove lock order and CAS; HTTP specs prove the contract
  and auth; Jest covers pure helpers and the loader; RTL covers the Admin.
- **Security-critical paths covered on the branch:**
  - Session-only auth and the negative cases (`security-boundaries.spec.ts`, "country-language Admin
    routes" and the updated TC-1).
  - Strict JSON and size limits (`translations.spec.ts` "rejects %s without writing").
  - Replay and stale CAS, and the deactivation/assignment races on independent instances
    (`country-language-configuration.spec.ts`).
  - Forged locale and country headers (`middleware.test.ts`, `request.test.ts`).
  - Refresh-tag bounds (`ui-translations-refresh.test.ts`).
  - Missing-key report bounds (`missing-key-server.test.ts`, `missing.test.ts`).
- **Not run:**
  - The browser foreign-origin CSRF case and the ninth-language end-to-end journey
    (`apps/storefront/e2e/visual/locale-links.functional.spec.ts`,
    `region-switcher.functional.spec.ts`).
  - Against a development backend, the CSRF case proves the CORS preflight and the strict-JSON
    defence, but not that the cookie is withheld.
- **Finalization results (from the dispatcher; not re-run here):**
  - Backend: unit 542/542, Admin 50/50, modules 478/480 (baseline BC spec plus its `.medusa`
    copy), HTTP 239/248 (quote baseline, plus a pre-existing `shipment-tracking.spec.ts` failure
    that comes from develop, NIMBUS-130 vs NIMBUS-191).
  - Storefront: 520/523 (`main-layout.test.tsx` pre-existing; `product-tabs/index.test.tsx`, a
    duplicate React through react-markdown, with imports unchanged on the branch but not confirmed
    at the merge-base).
  - Typecheck at baseline (backend 22 plus 3 in the untracked probe; storefront 8); lint 0 errors.
  - Builds: backend passes only with the probe moved aside; storefront passes only with a backend
    on :9000 (pre-existing).

## Open questions

1. **Unrun browser checks.** The plan's blocking verification gate names auth and browser negatives
   and the ninth-language runtime check. Options:
   - (a) run `pnpm --filter @b2b-starter/storefront test:visual -- locale-links region-switcher --project gb-desktop`
     against a disposable backend with `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` and
     `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` before push;
   - (b) push and run them on a disposable or staging environment before the storefront rollout
     step;
   - (c) accept the HTTP-level coverage and record the gap.

   **Answer (Klaus Petersen, 2026-10-21):** (a) run them now against a local backend and storefront,
   local database only. **Outcome:** run against the local dev database (`localhost/nimbus-medusa-dev`,
   backend NODE_ENV development), project gb-desktop. The fourth run passed 5/5: the ninth-language
   journey (4.1 min: Admin save, Admin and public read-backs, `html lang`, marked texts, decimal format,
   switcher, one distinct hreflang per published country), the project-country switcher label check,
   the foreign-origin case (credentialed JSON fetch blocked by the CORS preflight; text/plain form
   refused; version and assignments unchanged), plus the two existing locale/switcher navigation tests.
   The first three runs found branch defects, fixed with review before the fourth run (fix briefs 01–03):
   - The operator apply switch never reached the bootstrap script: `medusa exec` runs yargs in strict
     mode and rejects `--apply` (the HTTP spec called the script function directly, so it never saw
     this). The script now takes the bare positional `apply` and refuses other arguments; docs updated.
   - The journey added a country to a region mid-run, which storefront middleware cannot see for an
     hour (pre-existing module-level region cache); it now uses a country already in a region.
   - Fixture cleanup left a re-activated language active after a retry; the label test raced the
     journey; the journey's retry could not choose a country. Fixed (cleanup keyed on activation,
     label test limited to project countries, journey retries 0).
   - The cross-site form got **401** on the development backend: Chromium withheld the session cookie
     although Medusa sets no SameSite attribute there, not the expected 415 (the Deviations entry
     above, "expects 415 against a development backend", is superseded). The spec now accepts 401 or
     415 locally (exactly 401 on production-like backends) and always checks nothing was stored.

   **Local data left by the runs (cleanup state):** the fixture's restore ran in the passing run (`nl`
   language deactivated, the journey country put back on `en`, regions untouched; regions and users
   identical before and after the fourth run). Left behind on purpose or because the API cannot undo it:
   the country-language configuration is initialized (bootstrap `apply`, version 9); `nl` exists as an
   inactive language; `es` and `nl` carry explicit `en` entries (`nl` is a retained entry from the second
   run, when the old fixture added it to a region); the temporary Admin user
   `e2e-nimbus176@example.test` remains (a user cannot delete itself; remove it in Admin).
2. **Untracked `apps/backend/scripts/verify-region-query.ts`** (the planner's Region Query probe,
   referenced by PLAN.md and `samples/region-query-verification.json`). It has 3 strictNullChecks
   errors and breaks a local `medusa build` while present. Options:
   - (a) fix the errors and commit it as the evidence script;
   - (b) delete it and keep the JSON sample as the record (PLAN.md's reference then points to a
     missing file, but the case folder is frozen after ship);
   - (c) move it into `issues/NIMBUS-176/samples/` as non-compiled evidence.

   **Answer (Klaus Petersen, 2026-10-21):** (c) move it into `samples/` as evidence, out of the
   backend build, and commit the move.
3. **Rethrow Next's control-flow error in the loader.** Should `apps/storefront/src/lib/data/country-languages.ts`
   call `unstable_rethrow(error)` at the top of its `catch` (Findings 1)? Options:
   - (a) add it now as a fix commit (one line plus a test that a Next dynamic-usage error is not
     turned into the legacy fallback);
   - (b) accept as is, since pages are dynamic and nothing is baked, and note in
     `docs/architecture/country-languages.md` that `[countryCode]` routes must not adopt ISR
     `revalidate`;
   - (c) defer to a follow-up issue.

   **Answer (Klaus Petersen, 2026-10-21):** (a) add `unstable_rethrow` to the loader now, with a test.
4. **Activation is now session-only.** `POST /admin/ui-translations/:locale/activation` now refuses
   bearer tokens and secret API keys. Does any integration, script or Logic App call it with a token?
   Confirm "no" or name the caller.
   **Answer (Klaus Petersen, 2026-10-21):** No integration, script or Logic App calls
   `POST /admin/ui-translations/:locale/activation` with a bearer token or secret key; session-only
   is fine. All in-repo callers were verified to use a session. No change needed.
5. **Session cookie settings in each environment.** Medusa sets `SameSite=Lax; Secure` only when
   the backend's `NODE_ENV` is `production` or `staging`. Confirm the Medusa Cloud environments
   (including preview and staging) run with one of those values. Otherwise the foreign-form defence
   rests only on the strict-JSON check.

   **Answer (2026-10-21):** not answered at the gate. Recorded as a pre-deploy item owned by Klaus
   Petersen: confirm `NODE_ENV` for every Medusa Cloud environment before deploying. Does not block
   finishing the branch.
6. **Jira parent status.** NIMBUS-176 is in "Estimation". Its workflow has no direct transition to
   In Progress (only "Estimate approved" → To Do), so the dispatcher did not move it. Options:
   - (a) the human moves it through "Estimate approved", then In Progress;
   - (b) leave it in Estimation until review;
   - (c) the committer moves it as part of the PR step after the human confirms the estimate is
     approved.

   **Answer (2026-10-21):** not answered at the gate. Recorded as a pre-deploy item owned by Klaus
   Petersen: decide who moves NIMBUS-176 out of Estimation and when. Does not block the branch.
7. **Leftovers from consolidation.** Choose for each: fix now, or leave for a follow-up.
   - The duplicated `^[a-z]{2}$` check (route validator vs module `isCountryCode`).
   - The test-only `getCountryLanguageConfiguration()`.
   - The dead or test-only exports in Findings 4.
   - Older test names with plan ids (`TC-1`, `TC-2`, `TC-3`).
   - The stale `e2e/visual/README.md` `webServer` line.
   - The duplicated nav/footer region-option loop (pre-existing).

   **Answer (Klaus Petersen, 2026-10-21):** defer all of them to a follow-up chore; no change on this
   branch. The PR description lists them.
8. **`pnpm ai:check` fails on `AGENTS.md` size.** It is 33,861 bytes against 32,768; the overrun is
   pre-existing and grew with the Tier 0 rows this branch added. Options:
   - (a) accept for this branch and open a harness issue to trim `AGENTS.md`;
   - (b) shorten the new `decisions.md` rows now.

   **Answer (Klaus Petersen, 2026-10-21):** (a) accept the overrun on this branch; the size check is
   fixed separately (follow-up).

## Verify after deploy

- **01: Persist assignments and protect language integrity.** Read
  country_language_configuration.assignments and version for singleton
  country_language_configuration; compare dk language with bootstrap output and subsequent Admin
  save.
- **02: Publish validated country-language contracts and bootstrap.** GET /store/country-languages
  shows dk with the bootstrapped language, then reflects a saved test-country reassignment; Admin
  authenticated read returns its version and source.
- **03: Add Admin assignment management and feedback.** Translations country-language view shows dk
  and its effective/default source; save a configured test country to nl and read back the
  displayed saved language/version.
- **04: Resolve runtime language from one cached publication.** After Admin maps a configured test
  country to active nl, fresh country page shows nl provider/document language within five minutes;
  outage test records stale/legacy behavior and restart limitation.
- **05: Preserve formatting and SEO with rollout verification.** Record singleton
  assignments/version, GET /store/country-languages country/locale/source and rendered language/hreflang
  on the same configured nl test-country page, after a real Admin save; tests alone do not prove
  rollout.

Reviewer note for 04 and 05: read the document language after hydration in a browser (Findings 5).
On the server-rendered HTML, check hreflang and text instead.
