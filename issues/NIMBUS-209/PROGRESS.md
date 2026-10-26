# Progress

## 2026-10-22 — triage

- Outcome: request registered locally as `feature.md` (slug folder). No duplicate in Jira
  (`project = NIMBUS AND component = "Customer Portal"`, searched for Next.js, OpenNext, upgrade,
  storefront build). Jira issue not yet created: waiting for the human's yes.
- Proposed flow: full pipeline (`scoper` → `implementation-planner` → `task-dispatcher`).
- Next owner: human (approve Jira creation, then approve starting `scoper`).
- Handover prompt: "Create the Jira Story for issues/storefront-nextjs-16-upgrade, rename the folder
  to the key, then start the scoper on it."

## 2026-10-22 — Jira issue created

- Outcome: Klaus approved; Story NIMBUS-209 created (component `Customer Portal`, status Scoping)
  from `feature.md`. Folder renamed from `storefront-nextjs-16-upgrade` to `NIMBUS-209`.
- Next owner: `scoper` (Klaus approved starting it).
- Handover prompt: "Scope NIMBUS-209 from issues/NIMBUS-209/feature.md."

## 2026-10-22 — scoper

- Outcome: `scope.md` written (Story, full pipeline confirmed: checkout cache invalidation, about
  four tasks). Key findings: single-argument `revalidateTag` is deprecated in 16.4.2 and the `"max"`
  form would serve stale carts, so invalidation keeps immediate expiry (`updateTag` in server
  actions); the account `@dashboard`/`@login` slots need `default.tsx`; `next lint` is gone; OpenNext
  1.20.13 supports only Next `>=16.4.1` in the 16 line. Not yet recorded in Jira: the "scope approved"
  comment and transition wait for Klaus's approval.
- Next owner: Klaus (approve the scope and answer the open questions; then a separate go-ahead for
  `implementation-planner`).
- Handover prompt: "Scope for NIMBUS-209 approved: record it in Jira, then (on a separate yes) plan
  issues/NIMBUS-209/."

## 2026-10-22 — scope approved

- Outcome: Klaus approved the scope. Jira comment added (business rules, key decisions, the four open
  questions, still unanswered) and NIMBUS-209 moved to Estimation via "Scope approved".
- Next owner: Klaus (answer the open questions; separate go-ahead for `implementation-planner`).
- Handover prompt: "Plan NIMBUS-209 from issues/NIMBUS-209/scope.md."

## 2026-10-22 — open questions answered

- Outcome: Klaus answered the scope's open questions (recorded as a Jira comment on NIMBUS-209):
  1. Wrangler on Medusa Cloud: accept the risk (OpenNext only warns); covered by a smoke test.
  2. Verification: the Medusa Cloud preview environment of the pull request, before merge to
     `develop`.
  3. React stays at 19.0.5.
  4. The `middleware.ts` deprecation warning is accepted; the `proxy.ts` rename is NIMBUS-210
     (linked "relates to").
- Next owner: `implementation-planner` (Klaus starts it).
- Handover prompt: "Plan NIMBUS-209 from issues/NIMBUS-209/scope.md; the open questions are answered
  in PROGRESS.md."

## 2026-10-26 — implemented, merged, reverted and parked (recorded afterwards)

- Outcome: recorded on 2026-10-26 by the main session at Klaus's request, from git history; the
  entries below "open questions answered" were removed from this file by the revert.
  - The full pipeline ran on 2026-10-22: plan approved (154c4e1), tasks NIMBUS-211..214 committed
    (ed3cf4b, 137a02f, a0d9438, 2d8147d), consolidation ba0226c, gate passed, docs updated, branch
    pushed. The pre-revert records (`plan.md`, `deviation-report.md` and the full progress log) can
    be read at commit 51c1d6d (`git show 51c1d6d:issues/NIMBUS-209/plan.md`).
  - Merged as PR #3 (eb41388, 2026-10-22 18:43). On Medusa Cloud the storefront then failed: Cloud
    builds it with `@opennextjs/cloudflare` 1.19.8, which cannot serve Next.js 16.4 (every request
    fails loading `server/preview-props.json`). An adapter pin to 1.20.12 or later (08ffb45) was
    tried and reverted with the upgrade; the revert message says main stays on Next.js 15 "until
    Cloud ships adapter 1.20.12 or later".
  - Reverted the same evening (e3cfc50 reverts the merge; 2ad09f8 reverts the pin). `develop` and
    `main` are back on Next.js 15.5.28. The revert also removed this upgrade's changes to
    `docs/architecture/store-access.md` and `country-languages.md` and set `scope.md` back.
  - Jira: NIMBUS-209 is Parked; its sub-tasks NIMBUS-211..214 stay Done although their work is
    reverted. NIMBUS-210 (proxy.ts) is Parked for the same reason.
- Next owner: none until Medusa Cloud ships `@opennextjs/cloudflare` 1.20.12 or later for the
  storefront build.
- Handover prompt: "Unpark NIMBUS-209: confirm Medusa Cloud's storefront adapter is 1.20.12 or
  later, then re-apply the reverted merge eb41388 (revert e3cfc50) on a new branch and re-verify on
  a Medusa Cloud preview before merging."
