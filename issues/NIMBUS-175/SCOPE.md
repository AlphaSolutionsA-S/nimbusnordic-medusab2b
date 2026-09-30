# Admin translation editor for storefront UI text

- **Date:** 2026-09-30
- **Status:** Scoped — draft, awaiting user approval of this document
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-175 (parent epic NIMBUS-159 Multi-lingual frontend)
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-175/
- **Size:** L (upper end, after adding D14–D17)
- **Area:** Medusa Admin (new "Translations" page) + new backend module and API routes; storefront i18n loading
- **Base Branch:** develop
- **Requested by:** Klaus Petersen
- **Requested at:** 2026-09-30T07:57:13Z

## Background

The storefront's UI text (labels, buttons, messages) lives in one next-intl JSON file per
language (`da, de, en, fr, it, no, pl, sv`), about 31–34 KB each. They have 13 top-level
namespaces (`Common, Layout, Checkout, Account, Cart, Products, Catalog, Home, Shipping,
Quotes, Order, MetaDescription, Metadata`) and about 576 texts per language. Each file is
bundled into the storefront build. Every wording change or new translation needs a developer
and a deployment.

This story moves the live source of storefront UI text into the Medusa database. It also
gives admins a Shopify-style "Edit theme content" page for maintaining it: section tabs,
grouped headings, one labelled field per text, and search. See
`mockups/shopify-theme-content-reference.png`.

## Decisions (user answers, relayed by the coordinating agent on 2026-09-30)

| # | Topic | Decision |
|---|-------|----------|
| D1 | Runtime source of truth | The storefront reads translations **only from the Medusa database** at runtime. There is **no fallback** to `messages/*.json`, and the files are to leave the live path. |
| D2 | Data model | **One row per locale holding the full nested JSON document**, in a separate table owned by a custom module. (Decided by the user; see "Data model" below.) |
| D3 | Import | Upload a JSON file, then preview a diff (added / changed / removed keys), then the admin chooses **merge** or **replace**, then apply. |
| D4 | History | **No audit trail and no version/revision history.** |
| D5 | Placeholders | ICU placeholders/plurals are checked against the reference language (**English**). Mismatches show a **warning; saving is still allowed**. |
| D6 | "New texts from code" | The admin **uploads** a JSON file (e.g. a developer's updated `en.json`). The UI shows keys that are new or removed compared with the stored row. **The backend does not bundle copies of the files.** |
| D7 | Concurrency | **Stale saves are rejected.** Each locale row has a version; a save made against an old version is refused and the admin must reload. |
| D8 | Seeding | **Manual import through the UI, per environment.** No seed script and no data migration. |
| D10 | Access (was Q1; supersedes the role restriction originally in D4) | **Any logged-in Medusa Admin user** can view and edit. No extra role restriction; roles can be added later once Medusa RBAC (`MEDUSA_FF_RBAC`) is stable. |
| D11 | Missing row / backend unreachable (was Q2) | Serve the **last successfully cached copy**. If there is none, render the **raw message keys**. No fallback to the English row and no file fallback. |
| D12 | Refresh after save (was Q3) | **On save plus a timed backup.** The backend triggers storefront revalidation of the locale's cache tag on save/import (using the existing `REVALIDATE_SECRET` pattern), and a periodic time-based revalidation acts as a safety net. |
| D13 | `messages/*.json` files (was Q4) | **Kept in the repo as developer/import material**, not loaded at runtime. Developers add new keys there, admins import from them, and tests keep using them. |
| D9 | Type / priority / branch | Story, Medium, `develop`; the out-of-scope list from FEATURE.md is carried over (not re-confirmed). |
| D14 | Missing-key reporting | When `t('…')` finds no text (next-intl `MISSING_MESSAGE`), the storefront **logs a structured warning** (locale, key, page path), de-duplicated per locale + key, **and reports it to the backend**. The Translations page shows a **"Missing keys" list** per language. |
| D15 | Missing keys in the browser | **Server and client.** Client-side misses are batched, de-duplicated and rate-limited, and sent to a storefront route that logs and reports them. |
| D16 | Adding a language | **Admin creates the language in the UI; a developer maps it to countries in code** (`country-language-map.ts`, and `formatting-locale.ts` if needed) and deploys. Moving the country→language map into the DB is logged as a separate enhancement: NIMBUS-176. |
| D17 | New language start and go-live | A new language **starts as a copy of a chosen existing language, or from an import**. It is **inactive (not served to the storefront) until an admin activates it.** |

### Assumptions (A1 and A2 confirmed by the user as Q5; A3 replaced by D16)
- **A1 — Labels are derived from the key path.** Top-level namespaces become the section tabs
  (e.g. `Common`, `Checkout`). Nested objects become group headings. The last key segment
  becomes a humanised field label, e.g. `Common.notFound.headingLabel` shows as tab "Common",
  group "Not found", field "Heading label". There is no separate label catalogue.
- **A2** — The editor can edit values only. It cannot rename or delete keys; the key set
  changes through import (merge or replace). The one exception: an admin may add a value for
  a key listed in the "Missing keys" report (D14), which adds that key to the language.
- **A3** — *(Replaced by D16/D17.)* The admin's language list comes from the DB rows, not from
  the storefront's `SUPPORTED_LOCALES`. The storefront only reaches a language once a
  developer has mapped a country to it in code.

## Data model

**Chosen (D2):** a table in a new custom module with one row per locale:
`locale` (unique), `messages` (JSON document), `version` (for the stale-save check),
`is_active` (D17; only active rows are served to the storefront) and timestamps.
Import/export round-trips the document unchanged.

**Missing-key report (D14):** a second small table, one row per (`locale`, `key`) with
`count`, `first_seen_at`, `last_seen_at` and the last page path. Reports are upserts, so the
table size is bounded by the number of distinct keys, not by traffic. Admins can dismiss
entries; an entry is cleared automatically when the key gets a value in that language.

How the chosen model fits the decisions:
- **Size:** about 32 KB × 8 rows is trivial for PostgreSQL JSON and for one HTTP payload.
- **Concurrency (D7):** the version check on each row prevents silent lost updates. The
  cost is that two admins editing *different* texts in the same language also conflict,
  and the second admin must reload and redo their edits. This is accepted under D7.
- **Per-key diffing:** comparing languages, comparing with an uploaded file, and previewing
  an import all need the document flattened to key paths. That is cheap at this size but is
  code that must be shared and tested.
- **History:** none is wanted (D4). Exporting is the admin's backup.

**Considered and rejected (for the record):** one row per key
(`locale, key_path, value, updated_by, updated_at`). It would allow per-key concurrency, SQL
diffing/search and a natural change log. It was not chosen because the user wants the whole
document per locale, and history/per-key merging is not required.

## Requirements

### Functional

**Admin page**
1. The Medusa Admin navigation has a "Translations" page, available to any logged-in admin
   user (D10).
2. A language switcher covers every language stored in the DB (initially the 8 current
   locales), showing whether each is active.
3. The layout follows the mockup: tabs for top-level sections, group headings, and one
   labelled input per text (A1). The key path is visible or discoverable for each field.
4. Search and filter by key path or value, across all sections of the current language.
5. Edit and save a language. Saving sends the version the admin loaded; a stale version is
   rejected (D7) with a clear "someone else saved, reload" message.
6. Warn when a value's ICU placeholders or plural/select structure differ from the English
   value for the same key (D5). The save is not blocked.
7. **Compare languages:** show texts that are missing or empty in the current language
   compared with the reference language (English by default).
8. **Import:** upload a JSON file for a language, then see a preview of added, changed and
   removed keys, then choose merge (keep existing keys, add/overwrite from the file) or
   replace (the file becomes the document), then apply (D3). Import also creates the row for
   a locale that has none (D8).
9. **Compare with an uploaded file:** upload a JSON file and show the keys that are new
   (in the file, not stored) and removed (stored, not in the file), without changing
   anything (D6). This reuses the import preview, closed without applying (Q6).
10. **Export:** download a language as a JSON file in the storefront's nested next-intl
    format, parseable and equivalent to the stored document.
11. Show which of the 8 current storefront locales have no stored row yet, or are inactive
    (the storefront will be broken for those, see Risks).
12. **Add a language (D16/D17):** enter a locale code (validated BCP 47 tag, e.g. `nl`,
    `fi`, `pt-BR`), then start it as a copy of a chosen existing language or from an import.
    It is created inactive. The admin can activate or deactivate any language. The UI tells
    the admin that a developer must map countries to the new language before customers see
    it.
13. **Missing keys (D14):** a per-language list of keys the storefront requested but did not
    find, with count, first/last seen and last page. The admin can add a value (which adds
    the key, see A2) or dismiss the entry.

**Backend**

14. A custom module and tables per the data model, registered in `medusa-config.ts`, with a
    migration that creates the schema only (no data, D8).
15. Admin API routes to list locales, read one locale, create a locale (copy or import),
    activate/deactivate, save with a version check, and import (merge/replace); plus list and
    dismiss missing keys. Preview and diff may run on the client or on the server (for the
    planner to decide). Mutations go through workflows, per project convention.
16. A **store API route** that returns one **active** locale's messages for the storefront.
    It needs only the publishable API key, because the texts are public UI copy. The
    response must be cache-friendly. Inactive or unknown locales return not found.
17. A **missing-key report endpoint** on the backend. It is not a public write: it accepts
    reports only from the storefront server (shared secret, same pattern as
    `REVALIDATE_SECRET`). It validates locale and key format and caps batch size.
18. Validate at the boundary: the document must be a nested object whose leaves are strings,
    the locale must be a valid BCP 47 tag, and the document must stay under a size limit.
    Invalid JSON is rejected with a readable error.

**Storefront**

19. `src/i18n/request.ts` loads messages from the backend store route instead of
    `messages/<locale>.json`, with no file fallback (D1). `NextIntlClientProvider` in
    `[countryCode]/layout.tsx` and the root `not-found.tsx` path must use the same source.
20. Caching: fetched messages are cached per locale (Next.js data cache with a cache tag
    per locale). A save or import triggers revalidation of that locale's tag from the backend
    (a storefront revalidation endpoint protected by `REVALIDATE_SECRET`). A periodic
    time-based revalidate is the safety net (D12). A failed revalidation call must not fail
    the admin save.
21. When a locale row is missing or the backend cannot be reached, serve the last cached copy;
    if there is none, render raw message keys (D11). The failure is logged without secrets.
22. **Missing-key logging (D14/D15):** next-intl's `onError` / `getMessageFallback` are wired
    in `getRequestConfig` (server) and in a client wrapper around `NextIntlClientProvider`
    (functions cannot be passed from a server component). Each miss is logged as a
    structured warning (locale, key, path), de-duplicated per process for locale + key.
    Client misses are batched and sent to a storefront route handler, which rate-limits and
    forwards them with the server-to-server secret. When a whole locale is unavailable (the
    raw-keys case in D11), log and report that once, not one entry per key.
    Dynamically built keys (``t(`status.${x}`)``) are covered too, because detection is at
    runtime.

### Non-Functional
- **Security (OWASP A01/A03/A04):** admin routes require an authenticated admin user (D10). The store route is read-only. Imported JSON is validated and
  size-limited. Values are rendered as text, not HTML. Any revalidation call from the backend
  to the storefront uses the existing `REVALIDATE_SECRET` pattern, and the secret is never
  logged.
- **Performance:** loading translations must not add a backend round-trip to every page
  render; cached responses should be served in the common case.
- **Reliability:** the storefront must not crash when the data is
  temporarily unavailable; it serves the last cached copy, otherwise raw keys (D11).
- **Usability:** the page must stay responsive with about 600 fields per language (for
  example, render one section tab at a time).

## Affected Apps

- **backend:** a new translations module (model, service, schema migration), admin API
  routes, a store API route, workflows, and a new admin UI route with import/export/diff
  UI. Storefront revalidation trigger after save/import (D12), which needs the storefront URL
  and revalidation secret in the backend environment.
- **storefront:** replace file-based message loading in `src/i18n/request.ts` (and wherever
  else messages are loaded) with a cached fetch from the backend, and add revalidation
  handling. Update tests that `require` `messages/*.json` (e.g.
  `src/__tests__/lib/i18n/message-catalogs.test.ts`, metadata tests,
  `__mocks__/next-intl/server.ts`) where they assume runtime file loading. The
  `messages/*.json` files stay in the repo as developer/import material and remain valid
  for tests (D13). Update `src/lib/i18n/README.md` to describe the new runtime source.

## Proposed Structure (high-level tasks)

1. Backend translations module: model, service, schema migration, and registration in `medusa-config.ts`.
2. Shared pure helpers: flatten/unflatten, diff (added/changed/removed/empty), merge vs
   replace, ICU placeholder comparison, and key path → label. Covered by unit tests.
3. Admin API routes and workflows: list, get, save with version check, and import, with validators.
4. Store API route: get messages by locale.
5. Admin UI "Translations" page: locale switcher, section tabs, grouped fields, search,
   save/conflict handling, and placeholder warnings.
6. Admin UI import (preview → merge/replace), file comparison, compare-languages view, and
   export.
7. Storefront runtime loading, per-locale cache tags, a revalidation endpoint plus a timed
   backup, the last-cache-then-keys behaviour, and test updates.
8. Backend revalidation trigger on save/import/activate (env config via `mcloud`).
9. Add-language flow: create (copy or import), activate/deactivate, and BCP 47 validation.
10. Missing-key reporting: storefront server and client hooks, the storefront route handler,
    the backend report endpoint and table, and the admin "Missing keys" list.
11. Rollout notes per environment: deploy the backend → import and activate all 8 locales
    through the UI → deploy the storefront (see Risks). Also document the developer steps for
    mapping a new language to countries (D16).

## Risks

- **R1 — No file fallback (D1), partly mitigated by D11.** A backend outage is covered by
  the last cached copy. With no cache (a fresh storefront instance or deploy, or a locale
  never imported), customers see raw message keys on every page and in SEO metadata. The
  next-intl error/fallback handlers must render keys rather than throw.
- **R2 — Deployment order with manual seeding (D8).** A storefront deployed before the admin
  has imported all 8 locales in that environment (local, staging, production) will be broken
  for the missing locales. The rollout checklist must cover this.
- **R3 — Code/key drift.** New keys added by developers in code no longer arrive on deploy.
  An admin must import or merge the developer's file (D6/D3) before or at release, or the
  new texts show as missing. The team needs a process for this.
- **R4 — Coarse locking (D7).** Concurrent editors of the same language will see rejected
  saves. This is accepted, but the UI must make it clear and keep unsaved input visible.
- **R5 — Build/static generation.** Pages that are statically generated at build time will
  need the backend (with translations imported) to be reachable during the storefront build.
- **R6 — Mapping an inactive or missing language (D16/D17).** If a developer maps a country
  to a language that is inactive or has no row in that environment, customers in that
  country get raw keys (D11). The developer checklist must include "language exists and is
  active in every environment".
- **R7 — Missing-key report abuse and noise (D14/D15).** The browser → storefront route is
  public. Rate-limiting, batch caps, key-format validation and upserts keep the backend
  table bounded; the backend endpoint itself only accepts the server-to-server secret. A
  locale-wide outage must not flood logs with one line per key.

## Open Questions (for the user's approval step; recommended defaults given)

None. Q5–Q7 were answered by the user on 2026-09-30:

- **Q5 — Labels and editing:** confirmed A1 (labels derived from the key path, top-level
  namespaces as tabs) and A2 (the editor changes values only; keys change only through import).
- **Q6 — Compare with an uploaded file:** reuse the import preview screen; the admin can close
  it without applying. No separate read-only view.
- **Q7 — Replace imports that remove keys:** list removed keys prominently in the preview and
  require explicit confirmation before a replace that removes any keys is applied.

## Dependencies

- NIMBUS-159 (epic, multi-lingual frontend). NIMBUS-165 (key extraction; the key-parity test
  relies on the files). NIMBUS-167 (translated content in the current files; this is the
  import source for the first seeding). NIMBUS-173 (untranslated text bug).
- The planner must load the `building-with-medusa`, `building-admin-dashboard-customizations`
  and `building-storefronts` skills. Hosting is Medusa Cloud for both apps, so env changes
  (e.g. a storefront revalidation URL/secret for the backend) go through `mcloud`.
- Not used: Medusa's built-in Translation module (`MEDUSA_FF_TRANSLATION`) is for catalog
  entity translations. It does not fit the per-locale document model and product data is
  out of scope.

## Out of scope (carried over from FEATURE.md, updated for D16)
- Machine/AI translation suggestions.
- Product/catalog data translation.
- Transactional email/notification text (NIMBUS-162).
- Mapping countries to languages from the admin UI; this stays in code for now (D16).
  Enhancement: NIMBUS-176.
- Audit trail and revision history (D4).
