# SEO Metadata and hreflang

- **Date:** 2026-08-31
- **Status:** Scoped (draft — pending approval)
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-168
- **Epic:** NIMBUS-159 (Multi-lingual Storefront) — see `issues/NIMBUS-159/SCOPE.md` for shared
  decisions.
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-168/
- **Size:** S
- **Area:** Storefront (Next.js) — SEO metadata
- **Base Branch:** develop

## Background

With each country/region now rendering in its own language (NIMBUS-163–167), search engines
need to be told about the locale variants so each is indexed correctly and not flagged as
duplicate content.

## Requirements

### Functional

- Add `hreflang` alternate-language tags to every page, linking to the equivalent page across
  all 8 country/region URLs.
- Add locale-specific page metadata (title, description) reflecting each locale's language.

### Non-Functional

- Follows standard `hreflang`/canonical conventions so search engines don't treat locale
  variants as duplicate content.

## Affected Apps

- **storefront** only.

## Proposed Tasks

1. Add `hreflang` alternate links (Next.js `alternates.languages` metadata) per page, covering
   all 8 country/region URLs.
2. Localize page `<title>`/meta description generation per locale.

## Open Questions

- None. Sitemap.xml generation explicitly **excluded** from this story per stakeholder
  decision — tracked as potential separate follow-up if needed.

## Dependencies

- Depends on **NIMBUS-163** (routing/locale resolution foundation).
- Parent epic: **NIMBUS-159**.
