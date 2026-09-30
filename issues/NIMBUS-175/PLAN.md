# NIMBUS-175: Admin translation editor for storefront UI text

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-175
**Date:** 2026-09-30
**Status:** Draft implementation plan, awaiting review
**Base:** `develop` at `cdbc75a`
**Scope:** `SCOPE.md`, decisions D1-D17 and answered Q5-Q7

## Objective

Let Medusa administrators maintain the storefront's UI translations in the database,
with import/export, language comparison, controlled language activation, and a
missing-text inbox. The storefront uses those translations without a redeployment.

## Analysis

- The working tree was clean at planning start. Jira is a Story in Scoping with the
  Customer Portal component. It was unassigned and is now assigned to Klaus Petersen
  under the Jira workflow. No status transition is necessary to draft this plan;
  In Progress is recommended when implementation starts.
- The latest progress entry hands over from scope review to planning. Your request
  authorizes preparing this plan; neither scope approval nor implementation approval
  has been recorded. The manifest therefore remains **Ready for Dispatch: false**.
- The backend is Medusa 2.21.0 with PostgreSQL, Zod 4, React 18 Admin, Medusa UI
  4.2.4, TanStack Query 5.64.2, and `src/admin/lib/client.ts` using session authentication.
  Use a custom `storefrontTranslation` module, separate from Medusa's catalog
  translation module and its feature flag.
- The storefront uses Next.js 15.5.18 and React 19. `src/i18n/request.ts` is the
  runtime file import to replace. `[countryCode]/layout.tsx` obtains messages from
  next-intl and passes them to a provider. Root `not-found.tsx` already goes through
  `getTranslations`, so it needs verification rather than a second loader.
- Locale selection currently depends on middleware's `X-NEXT-INTL-LOCALE` header.
  Preserve that mechanism and the country mapping; adding an admin locale alone
  must not make it a new storefront route. NIMBUS-176 remains separate.
- Both apps have Jest infrastructure (`apps/backend/jest.config.js` and
  `apps/storefront/jest.config.ts`). Backend tests currently cannot render Admin
  TSX. Task 04 adds an isolated jsdom configuration; no new app-wide test framework
  or change to existing node test matching is needed.
- `REVALIDATE_SECRET` exists in the storefront template, but there is no existing
  storefront API revalidation route. Create a dedicated translation endpoint.
- Next 15 tag invalidation does not itself guarantee a usable stale entry after
  an on-demand invalidation. The installed cache implementation explicitly discards
  tag-invalidated entries. A last-good snapshot and production-mode outage tests
  are required; returning `{}` inside a cached fetch would incorrectly cache failure.
- The screenshot shows section tabs, group labels, and stacked editable fields.
  Use that layout with Medusa UI controls, one visible section at a time, plus
  global search. Do not substitute a generic key/value spreadsheet or a CMS editor.

## Execution Plan

| Task | Deliverable | Depends on |
| --- | --- | --- |
| 01 | Typed contracts and safe JSON/diff/ICU helpers | None |
| 02 | Locale and missing-key models, schema migration, atomic persistence | 01 |
| 03 | Admin/store/report APIs and mutation workflows | 01, 02 |
| 04 | Admin test harness and core Translations editor | 01, 03 |
| 05 | Import/export, comparison, add-language, activation, missing-key tools | 04 |
| 06 | Storefront database loader, cache/fallback, provider wiring | 03 |
| 07 | Revalidation callback and server/browser missing-key reporting | 03, 06 |
| 08 | Cross-app validation and per-environment rollout instructions | 05, 07 |

Task files contain the implementation contracts, skeletons, and tests. Tasks 04-05
and 06-07 may proceed independently after Task 03. Task 08 joins both tracks.
No application code is part of this planning change.

## Decisions & Trade-offs

1. **Whole-document persistence with atomic conflict detection.** One row per
   canonical locale holds nested messages, active status, and a version. An SQL
   compare-and-swap updates `WHERE locale = ? AND version = ?`; zero updated rows
   becomes HTTP 409. The same protection covers saves, imports, and activation.
   Clearing resolved missing entries is in the same transaction. A separate read
   followed by an unconditional update is insufficient.
2. **Server-authoritative previews.** Import previews return added, changed,
   removed, and empty keys plus ICU warnings at the loaded version. Applying an
   import revalidates the document and recomputes the diff. Destructive replace
   requires `confirm_removed: true`; stale previews cannot overwrite new work.
   Normal editing changes existing values only. Filling a reported missing key
   uses its own operation; it is not a general key-creation API.
3. **Warnings, not an English fallback.** Use an ICU AST parser to compare
   argument names/types, rich-text tags, and plural/select structure. Locale-specific
   plural categories can legitimately differ. Invalid syntax and mismatches are
   visible warnings and do not block saving. Missing English means comparison is
   unavailable, not that English files should be read. Keep the source JSON files
   as developer/import/test material only.
4. **Cache behavior.** Cache validated active documents per locale for 300 seconds
   with `ui-translations:<locale>`. Successful loads update a bounded last-good
   in-process snapshot. On network failure or missing row, use an available cached
   document, then that snapshot, then `{}` with raw-key fallbacks. Never cache an
   outage as an empty successful document. Cold instances with no surviving cache
   render keys, as allowed by scope R1; this plan does not promise durable snapshots
   across deployments or add a Redis service. Prove warm/cold behavior in a real
   production build before accepting Task 06.
5. **Activation clarification for review.** Treat a confirmed inactive locale as
   intentionally unavailable: discard its local last-good snapshot and render keys.
   Ordinary missing-row/network failures may use the snapshot. Return 404 with
   distinct stable codes for inactive versus absent rows. This makes D17 meaningful
   after deactivation while preserving D11 for outages. A previously opened browser
   updates on its next navigation/refresh; no live push is planned. Other workers
   converge through the timed refresh if a callback reaches only one worker.
6. **Small, bounded reporting pipeline.** Public browser reports go only to the
   storefront. It validates, sanitizes paths, deduplicates, rate-limits, and forwards
   using a server-only secret. The backend independently caps batches and database
   cardinality, rejects already-resolved reports, and performs atomic upserts.
   A locale outage is one reserved report, not hundreds of missing keys. Counts
   describe accepted reports after deduplication, not exact page-view statistics.
7. **Non-blocking refresh.** After a committed mutation, call the configured
   storefront revalidation URL with a short timeout. Failure produces a sanitized
   warning and a successful save with refresh status; it never rolls the saved
   translations back. Timed refresh is the backup. Callback URLs come only from
   server configuration, never import files or request bodies.
8. **Manual rollout.** Deploy backend/schema and Admin first; manually import and
   activate `da,de,en,fr,it,no,pl,sv`; verify public reads; then deploy storefront.
   No seed script, data migration, audit history, or changes to country mapping.

The proposed numeric limits, refresh interval, inactive-locale behavior, and
process-local snapshot limitation above are implementation decisions for plan
review, not additional answers attributed to the user.

## Verification

- [ ] Pure tests: string-leaf JSON round trips, empty-group preservation when
  updating edited leaves, safe flatten/merge, structural collisions,
  prototype-pollution rejection, ICU warnings, labels, and language comparisons.
- [ ] PostgreSQL tests: schema up/down/up, unique locales, one winner for concurrent
  saves, stale activation/import, atomic missing-report upserts, and resolution races.
- [ ] HTTP tests: admin/customer/anonymous permissions; publishable-key reads;
  inactive/unknown locales; secrets absent/wrong; bounds, 409s, destructive imports.
- [ ] Admin interaction tests: edit/save with empty-group preservation, original
  eight-locale import readiness (missing/imported inactive/imported active),
  search across tabs, empty/loading/error
  states, retained unsaved work after 409, import preview/confirmation, new inactive
  language, compare/export, and missing-key fill/dismiss.
- [ ] Storefront tests: exact locale mapping, runtime reads from API, server/client
  raw-key fallback, root 404 and metadata, TTL/callback refresh, last-good recovery,
  no file or English fallback, and bounded non-recursive reporting.
- [ ] Production-mode checks: two editors, two storefront workers, backend outage
  before/after cache warming, failed callback, activation, deactivation, and recovery.
- [ ] Builds, lint, typechecks, focused tests, and broader suites run against a fresh
  baseline captured for this revision. Earlier security-review results and
  NIMBUS-174's baseline are historical, not evidence of current validation.
- [ ] Integration tests retain the Business Central test-environment guard in
  `integration-tests/global-setup.ts`; use disposable PostgreSQL and mocked BC
  calls. Do not bypass the guard or use production integration credentials.

## References checked

The plan uses the installed versions as the implementation authority.
[Next.js 15 revalidateTag](https://nextjs.org/docs/15/app/api-reference/functions/revalidateTag)
documents the single-argument API and request-triggered invalidation.
[next-intl configuration](https://next-intl.dev/docs/usage/configuration)
documents the separate client error handlers and raw-key fallback hooks.

## Handover

Review this plan, especially decisions 4-6. After explicit approval, record it in
`PROGRESS.md`, mark `manifest.md` ready, and use the implementor on
`feature/NIMBUS-175` from `develop`. Do not start implementation or deployment on
the strength of this draft.
