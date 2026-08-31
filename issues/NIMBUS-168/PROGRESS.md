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
