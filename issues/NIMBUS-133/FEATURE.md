# Forget password flow

- Tracker: Jira (NIMBUS) — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-133
- Priority: Medium in Jira at intake; MoSCoW not agreed.
- Size: Not estimated.
- Area: Customer Portal — account recovery.
- Requested by: Klaus Petersen (requested scoping).
- Requested at: 2026-10-23 (exact UTC request time not recorded).

## Description
An existing Customer Portal customer who has forgotten their password can request an email link and use it to choose a new password without knowing the old one. Klaus clarified the scope decisions on 2026-10-23; SCOPE.md records the agreed boundaries and retained defaults.

## Why
Customers should be able to regain access to their own portal account without asking support to change their password.

## Acceptance criteria
Agreed scope and accepted defaults:
- [ ] The login screen offers a forgotten-password flow that is usable while signed out.
- [ ] A request shows the same neutral acknowledgement whether or not an eligible account exists.
- [ ] Reset instructions are dispatched for an existing eligible customer through Medusa Notification on channel `email`, using the existing provider setup and the account's address. Inbox delivery is checked after deployment with a delivering provider.
- [ ] A valid link lets its recipient set and confirm a new password of at least eight characters without the old password.
- [ ] Expired, invalid, previously used and superseded links cannot change a password; the customer can request another link.
- [ ] After success, the old password no longer logs in, the new one does, and the user returns to normal login without being automatically signed in.
- [ ] The recovery screens follow the portal's country/language experience and work on mobile and with a keyboard.
- [ ] Reset email is English; broader email localization remains NIMBUS-162.
- [ ] Links expire after 15 minutes, are single-use, and are superseded by a newer request.
- [ ] Existing sessions follow standard Medusa behaviour; no custom revocation or promise of logout on other devices.

## Out of scope
- Changing a password while signed in (NIMBUS-134), Medusa Admin/CMS recovery, invitation or registration changes, changing an account's email, and company-wide password resets.
- General translation of all transactional emails (NIMBUS-162).
- Adding/provisioning a mail provider, sender/domain or mail infrastructure; custom revocation of existing sessions.

## Open questions
None for the scope stage. Framework/security verification remains for implementation planning, which has not started.

## Mockups / references
- https://docs.medusajs.com/resources/storefront-development/customers/reset-password
- NIMBUS-134: https://alphasolutionsdk.atlassian.net/browse/NIMBUS-134
- NIMBUS-162: https://alphasolutionsdk.atlassian.net/browse/NIMBUS-162

## Technical notes
No implementation plan has been created. See SCOPE.md for current-code evidence, security acceptance targets and the limitation that the checked-in local notification provider logs rather than delivers mail. Reset secrets must not be passed to that logger.
