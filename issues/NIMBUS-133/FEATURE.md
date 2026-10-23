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
- [ ] Links expire after 15 minutes, reject sequential reuse and are superseded by a newer sequential request. Concurrent reuse risk is accepted; no custom locking/storage.
- [ ] Existing sessions follow standard Medusa behaviour; no custom revocation or promise of logout on other devices.

## Out of scope
- Changing a password while signed in (NIMBUS-134), Medusa Admin/CMS recovery, invitation or registration changes, changing an account's email, and company-wide password resets.
- General translation of all transactional emails (NIMBUS-162).
- Adding/provisioning a mail provider, sender/domain or mail infrastructure; custom revocation of existing sessions.
- Token-log/retention hardening and concurrent-reuse protection: existing Notification behaviour and core race limitations are accepted by Klaus.

## Open questions
None for the scope stage. PLAN.md records the implementation breakdown and remaining technical verification.

## Mockups / references
- https://docs.medusajs.com/resources/storefront-development/customers/reset-password
- NIMBUS-134: https://alphasolutionsdk.atlassian.net/browse/NIMBUS-134
- NIMBUS-162: https://alphasolutionsdk.atlassian.net/browse/NIMBUS-162

## Technical notes
PLAN.md is prepared for review. See SCOPE.md for evidence and accepted logging/concurrency risks. The local provider logs rather than delivers mail; this is accepted, but inbox delivery remains an after-deploy check with an existing delivering provider.
