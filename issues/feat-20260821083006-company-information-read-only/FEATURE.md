# Make company information read-only in the storefront

- **Date:** 2026-08-21
- **Status:** Feature captured
- **Type:** Story
- **Tracker:** JIRA — Not yet filed (Atlassian MCP unavailable during capture)
- **Priority:** Medium
- **Project Folder:** issues/feat-20260821083006-company-information-read-only/
- **Size:** M
- **Area:** Storefront company profile / Admin company view
- **Base Branch:** develop
- **Requested by:** Klaus Petersen
- **Requested at:** 2026-08-21T06:30:06Z

## Description

All company information shown in the storefront must be read-only. Customers may view their
company information but must not be able to change it in the storefront.

The backend company view must display a clear notice that company information available in
Business Central is authoritative. Any changes made to those fields in Medusa will be
overwritten with the corresponding Business Central values when a customer from the company
logs in.

## Why

Business Central is the source of truth for the company information it provides. Preventing
storefront edits avoids presenting customers with changes that will later be discarded, while
the backend notice warns administrators before they edit values that the login synchronization
will replace.

## Acceptance criteria

- [ ] Customers can view all available company information in the storefront.
- [ ] All company information in the storefront is read-only, with no controls or actions that
      allow a customer to change it.
- [ ] The backend company view clearly states that Business Central is the source of truth for
      company information available in Business Central.
- [ ] The backend notice explains that changes made in Medusa to Business Central-managed
      information will be overwritten from Business Central when a customer from the company
      logs in.
- [ ] The notice distinguishes Business Central-managed information from Medusa-only
      information, which is not overwritten by the Business Central login synchronization.
- [ ] The behavior and wording are consistent with the company synchronization captured in
      [NIMBUS-156](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-156).

## Out of scope

- Making company information read-only in the backend company view.
- Changing which company fields are synchronized from Business Central under NIMBUS-156.
- Writing company information from Medusa back to Business Central.

## Open questions

- Which storefront page or pages must display the complete read-only company information?
- Should existing storefront edit actions be removed entirely or replaced with guidance on
  contacting an administrator?
- Where should the Business Central overwrite notice appear in the backend company view?
- Should Business Central-managed fields also be visually identified individually in the
  backend?

## Mockups / references

- Related synchronization story:
  [NIMBUS-156](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-156)
- Engineering detail for the related story:
  https://github.com/AlphaSolutionsA-S/nimbusnordic-medusab2b/blob/develop/issues/NIMBUS-156/FEATURE.md

## Technical notes

*(Leave empty initially. Implementation plan goes in `PLAN.md` once work starts.)*
