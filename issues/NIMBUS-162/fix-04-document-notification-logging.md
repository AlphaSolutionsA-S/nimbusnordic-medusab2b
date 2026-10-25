# Fix brief 04: document the accepted notification-provider logging

**Issue:** NIMBUS-248 (invitation email). Gate answer 2 (Klaus Petersen, 2026-10-25): accepted
("it is ok"); document it next to the NIMBUS-133 note; no code change, no new issue.

## Fact (verified by the integration reviewer)

The configured provider `@medusajs/medusa/notification-local` (`apps/backend/medusa-config.ts`)
logs `to`, `template` and `JSON.stringify(data)` at info level
(`notification-local` 2.21.2, `dist/services/local.js`). So each reset email logs the recipient and
the reset URL with its token (already accepted for NIMBUS-133), and each invitation now logs the
invited address and the login URL (no credential).

## Change

In `docs/architecture/store-access.md`, next to the "Accepted limits" paragraph of the password
recovery section (around the NIMBUS-133 note) or in the "Employee invitation email" section,
state in plain words: the configured local notification provider logs the recipient and the
notification data for both emails; for the invitation that is the invited address and the login
link; accepted by Klaus Petersen for NIMBUS-242 on 2026-10-25, as for the reset link in NIMBUS-133.
Keep it short and in the doc's style. Docs only: no code, no `ai/` file (fix 02 has uncommitted
changes in `ai/architecture/decisions.md`; do not touch it).

## Done when

The doc states the accepted risk once, in the right section; nothing else changes.

## Deviations

- Placed as a short "Accepted limit" paragraph closing the "Employee invitation email" section
  rather than inside the reset section's "Accepted limits": the reset section already says the
  provider may log the reset URL, so the invitation section is where the new risk is missing.
- The paragraph names the issue keys (NIMBUS-242, NIMBUS-133) and the date but not the approver's
  name, matching how the doc records the NIMBUS-133 acceptance; the name is in this brief and the
  deviation report.
- The doc's "Last updated" and "Related work" header lines are unchanged ("nothing else changes");
  `documentation-writer` updates them when the feature ships.

## Done-when evidence

- Fact re-verified in installed source before writing: `apps/backend/medusa-config.ts:46` resolves
  `@medusajs/medusa/notification-local`; `node_modules/.pnpm/@medusajs+notification-local@2.21.2_.../dist/services/local.js`
  `send()` builds `to`, `channel`, `template` and `JSON.stringify(notification.data)` into one
  message and calls `this.logger_.info(message)`.
- Accepted risk stated once, in the right section: `docs/architecture/store-access.md`, new
  paragraph at the end of "Employee invitation email" (check: `git diff` on that file shows only
  this added paragraph).
- Nothing else changes: docs only; no code, no `ai/` file, so no tests were written or run (none
  apply to a docs-only change); fix 02's uncommitted files untouched.
- Also update: none listed; no other doc describes the invitation email's logging.
