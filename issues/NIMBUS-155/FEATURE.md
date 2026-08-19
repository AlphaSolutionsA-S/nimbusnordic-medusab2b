# Make BC customer number read-only in storefront

- **Date:** 2026-08-19
- **Status:** Feature captured
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-155
- **Priority:** Not set
- **Project Folder:** issues/NIMBUS-155/
- **Size:** S
- **Area:** Storefront / Company profile
- **Base Branch:** develop
- **Requested by:** Project stakeholder
- **Requested at:** 2026-08-19T18:52:22Z

## Description
Make the Business Central customer number read-only in the customer storefront's company profile. The value must remain manageable through the Admin experience.

## Why
The Business Central customer number is an integration identifier and should not be changed by storefront users, preventing accidental loss of order and customer synchronization context.

## Acceptance criteria
- [ ] The Business Central customer number cannot be edited from the storefront company profile.
- [ ] The existing Business Central customer number remains visible to authorized storefront users when present.
- [ ] Saving other storefront company-profile changes does not alter the Business Central customer number.
- [ ] The Admin experience continues to allow authorized users to manage the Business Central customer number.

## Out of scope
- Changing Business Central customer-number management in Admin.
- Changing the Business Central integration or synchronization behavior.
- Changing other storefront company-profile fields.

## Open questions
- None.

## Mockups / references
- Engineering detail: https://github.com/AlphaSolutionsA-S/nimbusnordic-medusab2b/blob/develop/issues/NIMBUS-155/FEATURE.md

## Technical notes
