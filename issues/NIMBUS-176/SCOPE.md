# Manage country-to-language mapping from Medusa Admin

> Record of NIMBUS-176, frozen when the work shipped. Not maintained: the code and docs/architecture/ describe current behaviour.

**Date:** 2026-10-20
**Status:** Implemented — scope approved by Klaus Petersen on 2026-10-20; branch feature/NIMBUS-176 ready for review 2026-10-21
**Type:** Story
**Priority:** Low (Jira)
**Issue:** [NIMBUS-176](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-176)
**Key:** NIMBUS-176
**Case folder:** issues/NIMBUS-176/
**Base Branch:** develop

## Background

Admins can create, translate and activate a language in Medusa Admin, but connecting it to a storefront country still requires a code change and deployment. This story lets admins manage that connection themselves. One country continues to use one storefront language; several countries may use the same language.

NIMBUS-175 is Closed in Jira. Its scope explicitly deferred country mapping to this story. The current feature is one deliverable across backend, Admin and storefront, with persistent configuration and a contract between apps, so it needs the full pipeline.

### Current behaviour checked in repository code

- Countries offered by the storefront come from the countries assigned to Medusa regions, not every country in the world.
- The static map contains dk→da, gb→en, se→sv, no→no, pl→pl, it→it, fr→fr and de→de. Other country codes resolve to English.
- Middleware and the country layout resolve language from that map. The translation request configuration independently permits only the eight existing languages. Missing-text reporting also has a fixed language list.
- Admin language creation already accepts valid BCP 47 language tags and starts languages inactive. Activation/deactivation has version checks, but deactivation currently does not check country usage.
- Formatting depends on the static supported list and mapping; a new language such as nl currently falls back to en-GB formatting. The SEO alternate-link helper reads the static map and uses language keys, so two countries sharing a language can overwrite an alternate URL.
- Runtime translation texts already come from the database. Their existing refresh mechanism has a five-minute timed backup; that does not establish a freshness guarantee for country mapping.

Evidence: apps/storefront/src/lib/i18n/country-language-map.ts; src/middleware.ts; src/i18n/request.ts; src/app/[countryCode]/layout.tsx; src/lib/i18n/formatting-locale.ts; src/lib/i18n/missing-key-validation.ts; src/lib/data/regions.ts; and backend src/modules/storefront-translation/service.ts plus src/utils/translations/validation.ts. Paths beginning src/ belong to the app named in the same sentence. These are source observations, not a hosted-environment verification.

## Requirements

### Functional

1. An authenticated Admin user can see every currently configured storefront country, its effective language and whether it has an explicit assignment or uses the default.
2. An Admin user can select an existing active language for a country and save the assignment. An invalid country or inactive/missing language is rejected by the backend, including direct API requests. Retained existing assignments for removed countries remain visible and may be explicitly reassigned; no new assignment may be created for an unconfigured country (clarification approved on 2026-10-20).
3. A saved assignment is persistent and used without a storefront deployment. This includes a language created in Admin beyond the original eight; replacing the map alone is insufficient.
4. Country URLs stay the same. Middleware, server rendering, client translations, document language, metadata, alternate links and missing-text reporting use the same published assignment. No customer language picker is added.
5. Deactivation of a language used by countries is blocked with affected countries listed until they are reassigned. English remains active as the default.
6. Preserve effective languages for existing configured countries during rollout. Do not silently activate a language to make an old mapping valid; report missing/inactive prerequisites before go-live.
7. Show loading, save failures and rejected edits clearly. A failed save leaves the previous assignment intact. Overlapping changes must preserve valid country/language combinations, including a concurrent deactivation.
8. Formatting follows the selected language, preserving existing formatting for current languages and accepting new valid language tags without code changes. Prices retain the region's currency and commercial rules; language assignment must not change those.

### Non-functional

- Cached configuration avoids a backend call for every page request. Changes normally appear on the next fresh page load/navigation, within five minutes while services are healthy. During outages retain last known assignments, or existing country-language behaviour on cold starts. The planner chooses the cache and refresh mechanism.
- Configuration works across storefront workers and process restarts; document any outage or refresh limitation instead of relying on one process's memory as persistent storage.
- Preserve the existing translation message source and missing-text behaviour except where dynamic language acceptance requires change.
- Admin controls follow the existing Admin design patterns and are keyboard accessible. New storefront text follows the runtime translation pattern.

## Business rules

The user approved B1–B9 and the draft data model on 2026-10-20.

| Rule | Action or state → outcome |
|---|---|
| B1 | Each country → one effective language; multiple countries may share a language. |
| B2 | Authenticated Admin user → may view and change Admin mapping configuration; storefront customers and anonymous callers → may not mutate it. |
| B3 | Assign an existing active language → allowed; missing/inactive language → refused by the backend. Active is the publication decision; no new translation-completeness gate is proposed. |
| B4 | Save a valid assignment → persisted and published without a code deployment. |
| B5 | Country assigned to a Medusa region → configurable; newly configured country without an explicit assignment → English, visibly marked as default. Unconfigured countries cannot receive new assignments. Existing assignments are retained when countries are removed, remain visible and may be explicitly reassigned to an existing active language, for later reuse subject to the active-language rule. Retained entries continue to block deactivation until reassigned. |
| B6 | Deactivate a language with explicit country assignments → refused with affected countries listed; admin reassigns them first. No automatic reassignment. English remains active while it provides the default. |
| B7 | Successful save → normally visible on the next fresh page load/navigation, with a maximum five-minute refresh delay while services are healthy. No forced reload of an already open page. |
| B8 | Configuration unavailable → keep last successfully loaded assignments where available; cold start without configuration → retain existing country-language behaviour. Exact stale-data lifetime remains a planning decision and must be documented. |
| B9 | Number/date formatting → follows selected language with existing formatting preserved for current languages; new valid language tags work without code changes. No separate Admin formatting editor. |

The acting Admin identity comes from the authenticated server session, never a submitted actor ID. Whether to persist an actor/history record is not specified by the intake; existing platform logging is retained, with no new audit-history UI proposed.

## Data model (draft)

This describes business data, not a decided table or API shape. Physical ownership and migration design belong to the planner.

| Entity or field | Key and meaning | Owner | Writer | Stored / derived | Sensitive? | Retention |
|---|---|---|---|---|---|---|
| Country catalogue | ISO 3166-1 alpha-2 country code assigned to a Medusa region | Medusa Region module | Existing region management | Existing stored data; membership derived | No | Existing region lifecycle |
| Language | Existing canonical BCP 47 locale and active flag | Storefront translation module | Existing language Admin actions | Existing stored data | No | Existing language lifecycle |
| Country assignment | Country code → one existing language locale; unique per country | Backend configuration; module/location ? | Authenticated Admin through validated backend mutation | Stored | No | Until changed; retained after country removal for later reuse |
| Effective assignment | Explicit assignment, otherwise default English | Backend publication rule | Derived from configuration | Derived, cached | No | Five-minute healthy refresh; outage policy B8 |
| Concurrency metadata | Revision/version of saved configuration | Assignment owner ? | Backend only | Stored; granularity ? | No | Current value; history ? |
| Actor attribution | Server-authenticated Admin identity | Platform auth; optional persistence ? | Backend only | Existing auth context; additional storage ? | Potential personal data if retained | Existing policy; additional retention ? |

## Security properties (draft)

This story adds protected configuration operations, not a new login system. The planner must verify framework guarantees from installed code/probes before relying on them.

| Property | Intended control | Trust root | Failure behaviour |
|---|---|---|---|
| Admin-only configuration | Authenticate and authorize every Admin read/write on the backend | Existing Medusa Admin user/session | Anonymous/store/customer credentials denied; no mutation |
| Valid assignments | Validate country membership and active-language state at save; preserve invariant during competing writes/deactivation | Backend-owned region and language data | Invalid/conflicting update refused; previous configuration retained |
| Replay and competing edits | Use current authorization and current state for each write; version/conflict semantics completed by planner | Backend persistence | Stale changes cannot bypass active-language protection |
| Cross-instance consistency | Enforce assignment/deactivation invariants in shared persistence | Database, not process-local lock/cache | A race cannot produce an inactive assigned language |
| Browser binding / CSRF | Reuse verified platform session and CSRF/origin protections for Admin mutations | Existing Admin auth platform | Untrusted browser request cannot perform an authorized mutation |
| Logout | Every write requires a currently accepted authenticated request; reuse platform logout semantics | Existing session validation | Logged-out/expired credentials denied according to verified platform guarantees |
| Public runtime read | Publish only country/language configuration needed to render the storefront; the Admin management view stays protected | Server-generated publication | No Admin identity, history, credentials or personal data disclosed |
| Personal data on failure | Log concise errors without session material or full user payloads | Server logging controls | Failures expose no identity/credential details |

## Affected apps

- Backend: persist/publish assignments, validate changes and protect language deactivation.
- Medusa Admin: country/language overview and editing; affected-country deactivation feedback.
- Storefront: dynamic language resolution, formatting acceptance, metadata/alternate links and reporting consistency.
- CMS: no change proposed. CMS content translation and email/product translation are outside this story.

## Proposed structure

High-level work streams for the planner; no implementation tasks or tracker children created yet:

1. Backend configuration ownership, initial data, publication and integrity rules.
2. Admin mapping view/edit flow and safe language deactivation.
3. Storefront runtime consumers, refresh/failure behaviour and consistent formatting/SEO/reporting.
4. Behaviour/contract verification, rollout prerequisites and current architecture/user documentation.

## Out of scope

- Multiple customer-selectable languages per country; language URL segments or country URL changes.
- Rebuilding the translation editor, translation creation/import, or adding a completeness approval workflow.
- Changing country availability, regions, currencies, pricing, cart/company authorization or payment behaviour.
- Separate formatting preferences/editor, general SEO redesign, translation audit-history UI, CMS or email translation.

## Open questions

No unresolved business questions remain from scope review. Priority remains Low; no urgency or delivery date was requested. Storage location, endpoint shape, cache implementation, stale-data lifetime, retained-assignment lifecycle details and vendor primitives remain technical planning decisions, subject to the approved business rules. The data-model and security tables retain explicit technical unknowns for the planner. Scope approval does not authorize implementation planning, commits or deployment.

## Dependencies

- NIMBUS-175 translation rows/editor/activation (Closed in Jira); active required languages must exist in each target environment.
- Current region-country catalogue and the existing storefront translation cache/reporting integration.
- Business rules and draft data model approved by the user on 2026-10-20. Scope-approved Jira comment 254657 recorded and the Scope approved transition completed; readback confirmed Estimation.
- Separate explicit instruction before handing off to implementation-planner.

## Documentation

- [docs/architecture/country-languages.md](../../docs/architecture/country-languages.md) — Country languages: assignments, publication, storefront resolution, rollout (created on the branch; updated for the control-flow rethrow, the no-ISR constraint, the `NODE_ENV` pre-deploy check and the browser-check results)
- [apps/storefront/src/lib/i18n/README.md](../../apps/storefront/src/lib/i18n/README.md) — Locale from the country publication; adding a language (updated on the branch)
- [apps/storefront/e2e/visual/README.md](../../apps/storefront/e2e/visual/README.md) — Country-language browser journeys and their environment (updated on the branch)

AI base files updated: `ai/architecture/layers.md`, `boundaries.md`, `decisions.md`, `data-ownership.md`, `ai/skills/medusa-storefront/project.md`, `ai/skills/nextjs-data-layer/project.md` (loaders rethrow Next control-flow errors)
