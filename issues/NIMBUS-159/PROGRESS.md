# Multi-lingual Storefront (Static UI Text)

- **Date:** 2026-08-31
- **Type:** Epic
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-159
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-159/
- **Updated by:** scoper workflow (run inline in main session)
- **Outcome:** Scope approved by user; Jira description updated; status transitioned to Estimation; implementation planning is the next stage.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Read `issues/NIMBUS-159/SCOPE.md` (approved) and produce a dispatch-ready implementation plan (manifest.md + task files) for extending the storefront's existing country/region routing (`apps/storefront/src/middleware.ts`, Medusa Store Regions) with a country→language mapping. Scope is storefront-only: a developer-maintained code/config file mapping each of 8 target country codes (da, en, sv, no, pl, it, fr, de) to its language plus a fallback, extraction of hardcoded UI strings into translation keys, confirming/building a site-wide region switcher (only checkout/account country-selects were found, per SCOPE.md), translated content loading, hreflang/SEO metadata, and cross-locale QA. Product/catalog content translation and transactional email localization are explicitly out of scope (email localization tracked separately as NIMBUS-162, linked to this issue).

## Related

- NIMBUS-162 — Multi-lingual transactional emails/notifications (linked as "Relates", split out during scoping; not yet scoped in detail).
- NIMBUS-26 — historical related request ("Håndtering af sprog"), closed Won't Do in 2022; reviewed during scoping, no reusable artifacts found.

## Stories Broken Out (2026-08-31)

Epic broken down into 7 child stories (all component `Customer Portal`, parented to NIMBUS-159), mirroring the Proposed Structure in SCOPE.md:

- NIMBUS-163 — i18n foundation & routing integration
- NIMBUS-164 — country to language mapping config
- NIMBUS-165 — extract UI text into translation keys
- NIMBUS-166 — region switcher
- NIMBUS-167 — translated content for all locales
- NIMBUS-168 — SEO metadata and hreflang
- NIMBUS-169 — cross-locale QA

None estimated or assigned yet. Next stage remains handoff to the implementation-planner agent (see handover prompt above) — it can plan against these stories individually or re-evaluate the breakdown.

## Stories Individually Scoped (2026-08-31)

Each of the 7 child stories now has its own approved `SCOPE.md` and `PROGRESS.md` in
`issues/NIMBUS-<number>/`, with key decisions resolved per story:

- **NIMBUS-163** — next-intl chosen as the i18n library.
- **NIMBUS-164** — country→language table finalized (DK/GB/SE/NO/PL/IT/FR/DE →
  da/en/sv/no/pl/it/fr/de), fallback English, `DEFAULT_REGION` to be updated.
- **NIMBUS-165** — extraction only, no lint/CI safeguard against future hardcoded strings.
- **NIMBUS-166** — header placement, redirects to the target region's homepage on switch.
- **NIMBUS-167** — machine translation, no formal human review step.
- **NIMBUS-168** — hreflang + page metadata only, sitemap.xml excluded.
- **NIMBUS-169** — automated visual regression (greenfield tooling), desktop + mobile, all 8
  locales.

Jira descriptions for all 7 stories updated to match. Each story's `PROGRESS.md` hands off
individually to the implementation-planner agent.
