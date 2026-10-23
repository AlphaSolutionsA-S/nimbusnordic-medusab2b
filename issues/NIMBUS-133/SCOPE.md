# NIMBUS-133: Forgotten password in the Customer Portal

**Date:** 2026-10-23
**Status:** Scope agreed — ready for estimation; implementation planning not started
**Type:** Story
**Priority:** Medium (Jira at intake)
**Issue:** [NIMBUS-133](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-133)
**Key:** NIMBUS-133
**Case folder:** issues/NIMBUS-133/
**Base Branch:** develop

## Background
Jira originally contained only the title “Forget password flow”. This scope covers recovery for existing Customer Portal customer accounts using email/password. Klaus clarified the notification and link/session decisions on 2026-10-23; those decisions and the scope defaults are recorded below.

The current login screen has sign-in and registration, with no recovery entry point. Signed-in customers can already change their password using the old password; the backend requires a new password of at least eight characters. NIMBUS-134 covers that change-password feature. Recovery must work without a current login and without the old password.

Use Medusa Notification on channel `email`, reusing the existing provider configuration and conventions, as requested by Klaus with invitations as reference. Provider/domain provisioning is outside scope. Klaus accepts existing Notification persistence and local-provider token logging; no provider guard or special cleanup is required. Provider acceptance proves dispatch only; inbox delivery remains an after-deploy check with an existing delivering provider.

## Requirements
Requirements reflect the scope decisions and defaults recorded on 2026-10-23.

### Functional
- Offer “Forgot password” from the portal login, an email request form, neutral acknowledgement, and a link back to login.
- Dispatch an eligible existing customer's reset email through Medusa Notification on channel `email`, using the existing provider setup. Include a link to the trusted portal reset page; a submitted URL must not choose where the token goes. Do not add or provision a new provider.
- Show the same request acknowledgement for known and unknown accounts. Do not show a token, account identity or delivery-provider details in the response.
- Accept a valid reset link while signed out, including when opened in another browser or device. The reset page must remain reachable through the portal's country routing and login guards.
- Collect a new password and confirmation, enforce the existing minimum of eight characters on the server, and explain validation failures without changing the password.
- Reject missing, malformed, expired, wrong-account, wrong-actor, used or superseded tokens. Offer a fresh request when a link cannot be used.
- Change only the account authenticated by the reset proof. The old password must stop authenticating and the new password must authenticate normally.
- Show success and send the customer to normal login; do not create an authenticated session automatically.
- Use the existing database-backed UI translations and country/language selection for all screens, errors and success messages. The first reset email is English; broader transactional-email localization belongs to NIMBUS-162.
- Preserve the existing signed-in password change flow and all company memberships, roles and account data.

### Non-functional
- Accessible labels, keyboard use, password-manager support, understandable loading/error/success states, and the existing responsive account-page styling.
- Protect both request and submission paths against automated abuse; the planner must define enforceable limits and verify their behaviour across deployed instances, including direct calls to the backend.
- Do not introduce password logging or expose reset secrets/account details in client errors. Existing Notification persistence and local-provider token logging are accepted; no special logging/retention work is required.
- A failed delivery or request must never change a password. Failures must be diagnosable using redacted operational information, without claiming that mail reached the recipient merely because the provider accepted it.
- Verify security behaviour against the installed Medusa library and real HTTP/database integration; mocked success is insufficient. After deployment, prove delivery, reset and subsequent login using a controlled test account and mailbox.

## Business rules
Agreed scope rules and accepted defaults:

| Action or state | Allowed / refused / outcome |
|---|---|
| Anyone submits a syntactically valid recovery request | Neutral acknowledgement; send instructions only for an eligible existing customer email/password identity. No account creation. |
| Someone requests recovery for another person | This grants no access. Instructions go only to the address bound to the target identity. |
| Reset is submitted | The reset proof, not a browser login, submitted company/customer ID or company-admin role, determines the account that may change. Actor is the holder of the account-bound recovery proof, not a staff/admin user. |
| An unused valid link is submitted with matching valid passwords | Change that account's credential using core consumption. Sequential reuse is refused; concurrent reuse risk is accepted without custom locking/storage. |
| A link is used, expired or replaced by a newer request | Refuse further resets and offer a new request. Lifetime: 15 minutes; single use; only the latest link remains valid. |
| Password is too short or confirmation differs | Refuse the change. Existing product minimum: eight characters. |
| Recovery completes | No automatic login. Retain Medusa's standard behaviour for existing sessions; no custom revocation or promise that other devices are logged out. |
| Customer lacks access to the account email | Self-service recovery cannot proceed; changing the email or support-based identity recovery is outside this story. |

## Data model (draft)
This describes information and ownership, not a decision to introduce custom tables. Prefer Medusa's supported recovery primitives; the planner must establish the actual storage and lifecycle.

| Entity / field | Key and meaning | Owner | Who writes it | Stored / derived | Sensitive? | Retention |
|---|---|---|---|---|---|---|
| Customer email/password identity | Existing provider identity bound to customer account; email is the delivery address | Medusa Auth; customer data remains Medusa Customer-owned | Existing account flows; recovery updates credential only | Existing stored identity / credential hash | Yes | Existing account policy; unchanged |
| New password and confirmation | Transient recovery input; never an audit value | Auth flow; confirmation is presentation validation | Holder of valid recovery proof | Transient; password stored only as the provider's credential hash | Secret | No plaintext persistence |
| Reset proof and validation state | Account-bound token, expiry and one-use state; exact ID/hash storage must be verified | Medusa Auth if supported as documented | Core recovery flow | Token delivered transiently; server state as required by core | Secret | 15-minute validity; deletion/cleanup verified by planner |
| Notification delivery record | Existing dispatch attempt/result | Medusa Notification and existing provider | Recovery workflow | Existing core storage | Yes, recipient and token content | Existing retention accepted; no special cleanup |
| Country/language context | Presentation and reset destination context; never an authorization key | Existing storefront country/language publication | Trusted application configuration / existing publication | Derived; persistence only if required | No, absent recipient linkage | Request or notification lifetime |
| Abuse counters / redacted operational events | Limit request/submission abuse and diagnose delivery failure | ? — planner to identify supported mechanism | Backend/edge protection | ? | Potentially personal data | ? — bounded retention to be specified |

## Security properties (draft)
Intended controls below are acceptance targets, not claims about the installed library.

| Property | Intended control | Trust root | Failure behaviour |
|---|---|---|---|
| Trust anchor / account binding | Signed, expiring recovery proof bound to the target customer and provider; email substitution cannot retarget it; proof is not a login credential | Backend Auth identity and verification secret plus access to account mailbox | No password or session change; generic invalid-link result |
| Replay / concurrent use | Core sequential single-use/supersession; concurrent reuse accepted | Existing Auth state | Sequential reuse fails; no concurrent one-winner guarantee |
| Cross-instance consistency | Existing core shared database; no custom token list or lock | Existing core implementation | Concurrent consumption/issuance limitations accepted; normal expiry/binding still required |
| Browser binding / CSRF | Link may open in a different browser; viewing it does not reset or log in. Submission needs the valid proof and explicit password entry; no reliance on ambient customer cookies | Recovery proof and trusted application origin | No change on GET or invalid cross-origin submission |
| Account enumeration | Same request acknowledgement/status for known and unknown identities; evaluate timing and provider-error leakage | Public request handler and redacted error mapping | No account existence or eligibility details exposed |
| Actor isolation | Customer recovery cannot alter Admin/CMS credentials or another identity even if an email is shared | Actor/provider binding validated by Auth | Refuse wrong-actor or wrong-account proof |
| Logout / session lifecycle | No automatic login; retain standard Medusa behaviour for already-issued customer tokens and sessions, without custom revocation | Existing Medusa token/session authentication | Do not claim other devices or sessions have been logged out |
| Personal data on failure | No new password logs or account/provider details in UI errors; existing token logging/persistence accepted | Server-only transport and existing Notification | Generic recoverable UI error; no special token-log hardening |

## Affected apps
- **Storefront:** login entry, public recovery screens, server-side data actions, country routing, translations and recovery outcome.
- **Backend:** existing Medusa Auth integration, customer-only Medusa Notification dispatch on channel `email`, existing provider integration and security verification. No provider provisioning.
- **CMS / Medusa Admin:** no requested changes; shared notification handling must not alter their recovery behaviour.

## Proposed structure
High-level work areas, not an implementation plan or Jira subtasks:
1. Verify the supported Auth recovery contract and existing Notification integration against the agreed decisions.
2. Deliver the customer reset email and connect the portal's request/reset experience.
3. Verify security refusals, existing login/change-password behaviour, and end-to-end delivery/reset after deployment; document the resulting behaviour.

## Decisions and open questions
- **Klaus, 2026-10-23:** use a Medusa Notification on channel `email`, following the existing user-invitation convention. Reuse the provider setup; no new mail provider, sender/domain provisioning or infrastructure work is included.
- **Accepted scope default:** English reset email in this story; broader multilingual transactional emails remain NIMBUS-162. Portal screens retain existing translated UI.
- **Klaus, 2026-10-23:** single-use link accepted. Retain the proposed 15-minute validity and latest-link-only behaviour, matching the observed Medusa primitive.
- **Klaus, 2026-10-23:** existing-session behaviour is not important; choose the simplest supported approach. Retain Medusa's default without custom revocation, and do not promise immediate logout of other sessions.
- **Klaus, 2026-10-23, planning follow-up:** token logging is not a concern. Accept existing Notification persistence/local logging; remove fail-closed provider guards and special cleanup requirements.
- **Klaus, 2026-10-23, planning follow-up:** concurrent reuse is accepted as a risk. Use core consumption without custom locking/storage or atomic one-winner guarantees. Sequential single-use/latest-link behaviour remains.
- **Retained scope defaults:** existing storefront customer email/password accounts, minimum eight characters, normal login after successful reset and the boundaries above.

No outstanding scope business questions. Implementation planning has been requested; PLAN.md records its technical verification limits. No deadline beyond Jira's Medium priority.

## Dependencies
- Implementation planning was requested after scope publication; PLAN.md is the next review artifact. Implementation has not started.
- Existing Medusa Notification email-provider configuration, a trusted storefront URL per environment, and a controlled mailbox/test account for delivery verification. Provisioning or replacing mail infrastructure is outside scope; if the target environment has only the local logger, inbox delivery remains unverified until an existing delivering provider is available.
- Coordination with NIMBUS-134 (existing signed-in password change) and NIMBUS-162 (transactional email localization); neither is a prerequisite for this scope.
- Installed Medusa source supports 15-minute reset proofs, purpose validation, fingerprinted state, expiry checks, sequential single-use and supersession. Concurrent atomicity is unproven and explicitly accepted as residual risk, not a dispatch gate. Binding and password-validation order still need ordinary verification. Consumption precedes update; preserve core failure/retry semantics. No upgrade, custom token store or locking is required for the accepted race.

## Evidence and verification limits
- `apps/storefront/src/modules/account/components/login/index.tsx` and `templates/login-template.tsx`: sign-in/registration only; no recovery entry.
- `apps/storefront/src/modules/account/components/profile-card/index.tsx`, `lib/data/customer.ts`, backend `api/store/customers/me/password/validators.ts` and `workflows/customer/steps/update-customer-password.ts`: existing authenticated change-password flow, old-password verification, minimum eight characters.
- `apps/backend/medusa-config.ts`: only `@medusajs/medusa/notification-local` configured for email; no external mail-delivery provider in this configuration. Source search found no `auth.password_reset` subscriber.
- Invitation reference inspection: no custom invitation-notification handler was found in `apps/backend/src`. Installed core invitation workflows emit invitation events; installed Medusa `dist/subscribers/configurable-notifications.js` demonstrates Notification dispatch with `channel: "email"` and `createNotifications`. This supports the requested integration convention, not a claim that invitation email delivery was tested.
- Read-only exploration of installed `@medusajs/core-flows/dist/auth/workflows/generate-reset-password-token.js`, Medusa auth reset route and `utils/validate-token.js`, and Auth service `dist/services/auth-module.js`: supports the source observations above, but does not prove concurrent use or delivery. Installed Medusa reports **2.21.2**, whereas repository context says 2.21.0; planner must establish the dependency version used by the intended deployment.
- `docs/architecture/store-access.md`: logout clears local auth/cart cookies, while an already-issued bearer token remains valid until expiry. This is not evidence of the reset endpoint's session behaviour.
- Jira search restricted to component Customer Portal found NIMBUS-134 and NIMBUS-162; no duplicate recovery story was found in that search.
- [Medusa recovery notification documentation](https://docs.medusajs.com/resources/commerce-modules/auth/reset-password) and [storefront recovery guide](https://docs.medusajs.com/resources/storefront-development/customers/reset-password) consulted through the Medusa MCP on 2026-10-23.
- No runtime system was changed, no email was sent and no recovery/security behaviour was tested. Scope decisions are settled; delivery and the implementation design remain unverified.
