# SEO Metadata and hreflang

- **Date:** 2026-08-31
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-168
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-168/
- **Updated by:** scoper workflow (run inline in main session)
- **Outcome:** Scope approved by user; Jira description synced. Implementation planning is the next stage.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Read `issues/NIMBUS-168/SCOPE.md` (approved) and plan hreflang alternate-language tags plus localized page metadata (title/description) per locale, using Next.js `alternates.languages`. Sitemap.xml is explicitly out of scope for this story.

- **Date:** 2026-08-31
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan is ready; implementation is the next stage. Depends on NIMBUS-163 (locale resolution) and NIMBUS-164 (country list).
- **Handover to:** implementor agent
- **Handover prompt:** Implement `issues/NIMBUS-168/manifest.md`'s 2 tasks (01 hreflang helper + alternates on the 3 public pages, 02 localized title/description suffix) per their implementation files in the same folder. Both tasks touch the same 3 page files — sequence or combine per file to avoid overlapping diffs.

- **Date:** 2026-09-01
- **Updated by:** implementor agent
- **Worktree:** `D:\projects\Nimbus\nimbusnordic-medusab2b\.claude\worktrees\agent-a50835358fc6dfbdc`
- **Branch:** `feature/NIMBUS-168` (created from `develop` @ `8435da0`, which includes NIMBUS-163/164/165)
- **Outcome:** Both tasks implemented and combined per file as directed. Changes are staged/unstaged, not committed.

**What was implemented:**
- New `apps/storefront/src/lib/seo/locale-alternates.ts`: `buildLocaleAlternates(pathWithoutCountryCode)` builds the `alternates.languages` map for all 8 country/region URLs from `COUNTRY_LANGUAGE_MAP`. Confirmed `getBaseURL` is defined in `apps/storefront/src/lib/util/env.ts` (imported from there, not the placeholder path in the task skeleton).
- `apps/storefront/src/app/[countryCode]/(main)/products/[handle]/page.tsx`, `.../categories/[...category]/page.tsx`, `.../collections/[handle]/page.tsx`: each `generateMetadata` now (a) adds `alternates.languages` via the helper (categories keeps its existing `alternates.canonical` alongside it), and (b) resolves the locale via `getLocaleForCountry(params.countryCode)` and calls `getTranslations({ locale, namespace: "MetaDescription" })` to build the title suffix, replacing the hardcoded `"| Medusa Store"` string. Product/category/collection title and description content itself (Medusa data) is untouched — only the static suffix is localized.
- `account/@dashboard/orders/details/[id]/page.tsx` was left untouched as directed (private, non-indexable page, explicitly excluded from hreflang).
- Added `MetaDescription.storeSuffix` (`"| Medusa Store"`, English content) to all 8 locale catalogs (`da/de/en/fr/it/no/pl/sv.json`). Non-English translation is left for NIMBUS-167's MT process, consistent with how the rest of the catalogs currently hold English placeholder text pending translation.
- Verified all 3 touched page files read their CURRENT (post-NIMBUS-165) state before editing — no conflicting extraction work was present in `generateMetadata` in any of them (NIMBUS-165 didn't touch these specific functions).

**Tests added** (per task files' TC lists):
- `apps/storefront/src/__tests__/lib/seo/locale-alternates.test.ts` — TC-1: exactly 8 entries, correct URL shape; plus a leading-slash normalization case.
- `apps/storefront/src/__tests__/app/product-page-metadata.test.ts`, `category-page-metadata.test.ts`, `collection-page-metadata.test.ts` — cover Task 01's TC-2/TC-3 (hreflang populated, category's canonical preserved) and Task 02's TC-1/TC-2/TC-3 (localized suffix for a mapped locale, fallback to `en` for an unmapped country, product/category/collection data content identical across locales). These mock `next-intl/server`'s `getTranslations` to resolve from the real message catalogs by locale (same pattern as the existing `country-code-layout.test.tsx`), and stub out the page's template component (`ProductTemplate`/`CategoryTemplate`/`CollectionTemplate`) since only `generateMetadata` is under test — importing the full template tree pulls in `@vercel/analytics`, an ESM package this Jest setup can't transform (same rationale as the pre-existing `pending-customer-approvals` stub in `orders-page.test.tsx`).

**Test/build results:**
- `pnpm lint`: passes. Only 2 pre-existing warnings, both unrelated to this change (`cart-context.tsx`, `cart-drawer/index.tsx` — `react-hooks/exhaustive-deps`).
- `tsc --noEmit`: no errors in any file touched by this story. Several pre-existing errors remain elsewhere in the repo (`account-nav.test.tsx`, `company-card-bc-readonly.test.tsx`, `profile-card/index.tsx`, `cart-drawer/index.tsx`) — unrelated to hreflang/metadata, not introduced by this change, not fixed (out of scope; `next.config.js` already sets `typescript.ignoreBuildErrors: true` so these don't block `pnpm build`).
- `pnpm test`: **could not run directly** via the standard command in this worktree. Root cause (confirmed by inspection, not guesswork): this worktree lives at a path containing a `.claude` segment (`...\nimbusnordic-medusab2b\.claude\worktrees\agent-...`), and Jest's own `jest-util` `replacePathSepForGlob` (regex `\\(?![{}()+?.^$])`) refuses to convert a backslash to a forward slash when it's immediately followed by a glob-special character — and `.` (the leading dot of `.claude`) is in that excluded set. This corrupts the `<rootDir>`-substituted `testMatch` glob into an invalid mixed-separator pattern, so **zero** test files match, for every test in the repo, regardless of this story's changes. Confirmed via `--showConfig` that `rootDir` itself is correct; confirmed a directory junction to a dot-free path doesn't help (Windows resolves junctions transparently at the OS level, so Node still sees the real `.claude`-containing path). This is a pre-existing environment limitation of running tests inside a nested `.claude/worktrees/...` isolated worktree, not a defect in this story's code or config — reverted an initial (ineffective) `outputFileTracingRoot` attempt in `next.config.js` and left it untouched.
  - **Verified anyway** by hand-rolling a one-off patched Jest config (via `--showConfig`, swapping the broken `testMatch` glob for an equivalent `testRegex`, never committed, deleted after use) and running the full suite through it: **132 of 133 suites pass (236/238 tests)**, including all 5 new suites for this story. The 1 failing suite (`product-tabs/index.test.tsx`, "React Element from an older version of React" / multiple React copies) is unrelated to this story — it touches no file this story changed and reproduces from a dependency-resolution artifact of this worktree's fresh `pnpm install`, not from hreflang/metadata code.
- **Manual view-source verification: not done — flagged as outstanding.** No Medusa backend was reachable at `localhost:9000` in this environment (connection refused), so the dev server couldn't be started against live data to visually confirm `<link rel="alternate" hreflang="...">` tags. This should be done by whoever picks this up next, against a running backend: start `pnpm dev` in `apps/storefront` with a real/seeded backend, visit a product/category/collection page, and view-source to confirm all 8 `hreflang` links render with correct URLs, and that the `<title>` shows the localized suffix.

**Environment notes for whoever continues this branch:**
- This worktree had no `node_modules` and no `.env` on pickup; ran `pnpm install` at the repo root, and created a local (gitignored) `apps/storefront/.env` copied from `.env.template` with a dummy `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` — needed only to get `next.config.js`'s `checkEnvVariables()` to stop blocking Jest/lint from loading. Neither is part of the diff.

**Nothing left to do for this story's own tasks** — both manifest tasks (01, 02) are complete per their test-case lists. Outstanding item is the live manual hreflang check noted above, which needs a running backend this environment doesn't have.

- **Date:** 2026-09-01
- **Updated by:** implementation-planner (main session), closing the outstanding manual verification and merging into `develop`.
- **Outcome:** Manual view-source check complete — no regressions found. Merged into `develop` (`e4252e0..239cd56`) alongside NIMBUS-166, no conflicts.
  - Started `apps/backend` (`medusa develop`) and `apps/storefront` (`next dev -p 8000`) against the real Postgres instance used throughout this epic's verification.
  - Fetched a real product handle via the Store API and viewed the rendered `/gb/products/<handle>` page: `<title>` correctly shows `"...Audio | Medusa Store"` (localized suffix via `MetaDescription.storeSuffix`), and all 8 `<link rel="alternate" hreflang="...">` tags render with correct per-locale URLs (`da`, `en`, `sv`, `no`, `pl`, `it`, `fr`, `de`).
  - Checked a category page (`/gb/categories/laptops`): existing `<link rel="canonical">` preserved unchanged, plus all 8 hreflang alternates now present. Note: the canonical URL itself is a bare relative path missing the `/gb` locale segment — this is pre-existing behavior from before this story (not something NIMBUS-168 introduced or was asked to fix), flagging for visibility only.
  - Confirmed NIMBUS-166's region switcher (`aria-label`-driven `<select>`) still renders correctly on the product page alongside this story's metadata changes — no conflict between the two stories' changes to the same shared header/page tree.
  - Also independently verified the "1 pre-existing unrelated test failure" claim (`product-tabs`): confirmed it passes cleanly on `develop`, then reproduced it failing in the story's worktree even with the entire diff stashed out (both tracked and untracked changes) — proving it's an artifact of that worktree's own `pnpm install`, not a regression from this story's code. No action needed.
  - Dev servers stopped via `taskkill` after verification; confirmed both ports free afterward.
- **Handover to:** none — story complete and merged.
