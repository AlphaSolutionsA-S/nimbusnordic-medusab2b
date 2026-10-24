# NIMBUS-242 — Progress

## 2026-10-24 — Triage
- **Owner:** triage, on Klaus Petersen's request "make invite employee send an email".
- **Outcome:** Drafted `feature.md` (slug folder; no Jira issue yet). Kind: feature (the "Send invite" button promises an email that is never sent). Klaus decided: plain notification email, no credentials or set-password link, invite form unchanged; delivery via Medusa Cloud's built-in email. Jira search (component Customer Portal) found no duplicate and no issue covering email delivery configuration; related: NIMBUS-133, NIMBUS-162, NIMBUS-134.
- **Proposed route:** full pipeline (`scoper`): employee creation is company authorization (always full pipeline) and the email carries personal data. Small expected size; the scoper may hand it down to `quick-fix` only if the always-full-pipeline rule is set aside by the human.
- **Prerequisite (proposed separate item, not created):** make `medusa-config.ts` register notification-local on `email` only in development so Medusa Emails can deliver on Cloud, plus a verified sender domain in Cloud. Also needed by NIMBUS-133.
- **Language (decided by Klaus):** translation of the invite email moves to NIMBUS-162 with the reset email; the email uses the language of the storefront country it was triggered from. Sequencing is decided in NIMBUS-162. Link the two issues (Relates) when this issue is created.
- **Open:** exact text, login link, Admin-created employees.
- **Tracker:** No issue created; creation waits for Klaus's yes. On creation, rename this folder to `issues/NIMBUS-<n>/` and update the tracker line in `feature.md`.
- **Next owner:** Klaus Petersen: approve issue creation (and decide whether to file the delivery prerequisite), then a separate go-ahead for the scoper.
- **Handover prompt:** "Create the Jira issue from issues/invite-employee-email/feature.md (component Customer Portal, link NIMBUS-133 and NIMBUS-162), rename the folder to the key, then run the scoper on it."
- **Verification:** Source, installed-package and Jira reads only. Medusa Emails behaviour is from docs, not verified on Cloud. Nothing built, sent or tested; case folder uncommitted.

## 2026-10-24 — Issue created
- **Owner:** triage, after Klaus Petersen's yes ("invite issue - yes to jira", relayed from the main conversation).
- **Outcome:** Created Story [NIMBUS-242](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-242) "Invited employees receive an invitation email", component Customer Portal, status Scoping, unassigned. Linked Relates to NIMBUS-162 and NIMBUS-133. Comment 255267 links `feature.md`. Folder renamed from `issues/invite-employee-email/` to `issues/NIMBUS-242/`.
- **Delivery (decided by Klaus):** the Medusa Cloud email configuration and sender domain are already taken care of; this issue has no delivery work (no `medusa-config.ts` change, no sender-domain step), superseding the prerequisite in the triage entry. Delivery is confirmed only after deploy, in Cloud's Email Activity page.
- **Open:** exact text, login link, whether Admin-created employees also get the email (`POST /admin/companies/:id/employees` runs the same `createEmployeeAccountWorkflow` as the store route).
- **Proposed route:** full pipeline (`scoper`), unchanged.
- **Next owner:** Klaus Petersen for a separate go-ahead to start the scoper.
- **Handover prompt:** "Run the scoper on issues/NIMBUS-242/ (NIMBUS-242). Translation is NIMBUS-162's; delivery setup is out of scope."
- **Verification:** Jira returned the key, the component, both links and the comment. Case folder uncommitted; the feature.md link in Jira resolves only after commit.
