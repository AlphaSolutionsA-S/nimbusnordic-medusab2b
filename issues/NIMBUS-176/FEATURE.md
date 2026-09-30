# Manage country-to-language mapping from Medusa Admin

- **Date:** 2026-09-30
- **Status:** Feature captured
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-176 (parent epic NIMBUS-159 Multi-lingual frontend)
- **Priority:** Low
- **Project Folder:** issues/NIMBUS-176/
- **Size:** M
- **Area:** Medusa Admin + backend; storefront locale resolution (`apps/storefront/src/lib/i18n/country-language-map.ts`, middleware)
- **Base Branch:** develop
- **Requested by:** Klaus Petersen
- **Requested at:** 2026-09-30

## Description
Let admins choose which storefront language each country uses, from Medusa Admin, instead of a developer changing code and deploying. Follow-up to NIMBUS-175 (Admin translation editor), where admins can create a new language but a developer still has to connect it to countries.

## Why
With NIMBUS-175, admins can add and translate a new language themselves, but customers only see it after a developer maps countries to it and deploys. Moving the mapping to the admin removes that last developer step and the risk of mapping a country to a language that isn't ready.

## Acceptance criteria
- [ ] Admin can see which language each storefront country uses.
- [ ] Admin can change the language for a country and save it; the storefront uses the new language without a deploy.
- [ ] Admin can only assign active languages to a country.
- [ ] A language cannot be deactivated while countries still use it (or the admin is warned and must reassign them).
- [ ] Only authenticated admin users can view or change the mapping.

## Out of scope
- Anything already delivered by NIMBUS-175 (language rows, editor, activation).
- Changing the one-country-one-language rule (NIMBUS-159).

## Open questions
- Should the mapping live on Medusa regions/countries (e.g. metadata) or in the NIMBUS-175 translations module?
- How does the storefront middleware read the map without a backend call per request (caching, revalidation)?
- Does `formatting-locale.ts` (number/date formatting) also move to the DB?

## Mockups / references
- NIMBUS-175 `issues/NIMBUS-175/SCOPE.md` (decision D16).
- `apps/storefront/src/lib/i18n/country-language-map.ts` (current hardcoded map).

## Technical notes
*(Leave empty initially. Implementation plan goes in `PLAN.md` once work starts.)*

Depends on NIMBUS-175.
