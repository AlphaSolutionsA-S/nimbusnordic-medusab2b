# Translated Content for All Locales

- **Date:** 2026-08-31
- **Status:** Scoped (draft — pending approval)
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-167
- **Epic:** NIMBUS-159 (Multi-lingual Storefront) — see `issues/NIMBUS-159/SCOPE.md` for shared
  decisions.
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-167/
- **Size:** M
- **Area:** Storefront (Next.js) — translation content
- **Base Branch:** develop

## Background

NIMBUS-165 extracts UI copy into translation keys with English (default) content. This story
fills in the translated content for the remaining 7 locales (da, sv, no, pl, it, fr, de).

## Requirements

### Functional

- Machine-translate the extracted message catalogs from English into: Danish, Swedish,
  Norwegian, Polish, Italian, French, German.
- Load the translated content into each locale's message catalog established by NIMBUS-163.

### Non-Functional

- **No formal human review step for this story** — machine-translated output ships as-is.
  Translation quality issues will be addressed reactively later if reported, rather than
  gated on a review process now. (Decided during scoping; revisit if quality becomes an
  issue post-launch.)

## Affected Apps

- **storefront** only.

## Proposed Tasks

1. Run the extracted English message catalog through machine translation for each of the 7
   target locales.
2. Populate each locale's message catalog with the translated output.
3. Spot-check for obvious MT failures (untranslated placeholders, broken interpolation
   syntax) — not linguistic quality review.

## Open Questions

- None. Translation source (MT, no formal review) resolved during scoping.

## Dependencies

- Depends on **NIMBUS-165** (extraction) for the source keys/content to translate.
- Parent epic: **NIMBUS-159**.
