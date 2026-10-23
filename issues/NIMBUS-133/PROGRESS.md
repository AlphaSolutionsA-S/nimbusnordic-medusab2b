# NIMBUS-133 — Progress

## 2026-10-23 — Scope draft prepared
- **Owner:** scoper, following triage of the existing Story “Forget password flow”.
- **Outcome:** Created FEATURE.md and SCOPE.md with proposed recovery outcomes, business rules, draft data/security tables, exclusions and current-code evidence. Full pipeline confirmed because account recovery concerns authentication and spans storefront/backend. No implementation or planning started.
- **Decisions outstanding:** outbound mail service/sender and reset email language; link lifetime/replacement policy and whether recovery must immediately invalidate existing sessions. All proposed scope rules await review.
- **Tracker:** Jira is the source of truth for assignee/status. No scope-approved event or ready-state transition is authorized before actual scope approval.
- **Next owner:** Klaus Petersen for scope decisions and approval; scoper to revise and record the approved scope. Implementation-planner requires a separate subsequent instruction.
- **Handover prompt:** Review issues/NIMBUS-133/SCOPE.md, answer its two open questions, and confirm the proposed audience, rules and data/security boundaries. Do not start implementation planning yet.
- **Verification:** Source/documentation/tracker inspection only. No delivery, reset, session invalidation or deployed result verified. Case files are local working files until committed and reviewed.

## 2026-10-23 — Scope decisions resolved
- **Owner:** scoping follow-up on Klaus Petersen's answers.
- **Outcome:** Updated FEATURE.md and SCOPE.md. Use Medusa Notification on channel `email` with the existing provider setup; adding/provisioning a provider or sender/domain is outside scope. English reset email is the retained default; broader localization stays in NIMBUS-162. Link validity is 15 minutes, single-use, latest link only. Existing sessions follow standard Medusa behaviour without custom revocation or a promise of logout on other devices. No outstanding scope business questions.
- **Reference:** No custom invitation-notification handler was found in source. Installed invitation workflows emit events; the installed configurable-notifications subscriber demonstrates `createNotifications` with channel `email`. This is source evidence of the convention, not proof of invitation email delivery. Secrets must not be sent to the configured local logger.
- **Tracker:** Decision comment 255196 added to NIMBUS-133 without modifying its description. Fetched valid transitions and applied `Scope approved` (611); Jira returned status **Estimation**. Assignee remains Klaus Petersen.
- **Next owner:** Klaus Petersen for estimation/next-stage instruction. Implementation planning and implementation have not started; no commit or push performed.
- **Handover prompt:** Read this entry and SCOPE.md. If implementation planning is requested, verify remaining Medusa security/runtime properties and existing email-provider behaviour before dispatch; do not add mail infrastructure or custom session revocation.
- **Verification:** Documentation-only update and installed-source reference inspection. Jira returned the decision comment and Estimation status. No email sent, runtime flow exercised or deployed result verified; case files remain local and uncommitted.

## 2026-10-23 — Scope publication authorized
- **Owner:** Codex, following Klaus Petersen's instruction to commit and push.
- **Outcome:** Prepared the three scope documents for publication on `feature/NIMBUS-133`; no implementation changes included.
- **Verification:** Reviewed the scope documents and confirmed that the working tree contains only this case folder. Application tests are not applicable to this documentation-only change; staged whitespace validation runs before commit.
- **Next owner:** Klaus Petersen for estimation or a separate implementation-planning instruction.
- **Handover prompt:** Use the agreed SCOPE.md and the preceding decisions entry; implementation planning has not started.
