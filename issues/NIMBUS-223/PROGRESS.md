# Progress

## 2026-10-23 — triage

- Outcome: registered locally as `feature.md` (slug `admin-customize-page`; no Jira issue yet).
  Jira duplicate search (component `Customer Portal`) found no duplicate. Related: NIMBUS-216,
  NIMBUS-219, NIMBUS-176.
- Proposed flow: full pipeline (`scoper`). Reasons: relies on an undocumented Medusa dashboard API
  (`LayoutComposer`) with unverified behaviour; 8 pages across 5 Admin areas, more than about three
  tasks' worth; open design decisions (section split, per-user vs shared, widget zones).
- Next owner: Klaus, to confirm creating the Jira issue (then rename this folder to the key) and the
  go-ahead to start the `scoper`.
- Handover prompt: "Scope `issues/<key>/` (Customize page on custom Admin pages), starting from
  `feature.md`; verify `LayoutComposer` preference persistence and widget injection for custom zone
  prefixes first."

## 2026-10-23 — Jira issue created

- Outcome: Klaus approved; Story NIMBUS-223 created (component `Customer Portal`) from `feature.md`.
  Folder renamed from `admin-customize-page` to `NIMBUS-223`. NIMBUS-216 is merged into `develop`
  (local `develop` fast-forwarded), so `shipment-tracking/page.tsx` is no longer contested.
- Next owner: `scoper` (Klaus approved starting it).
- Handover prompt: "Scope NIMBUS-223 from issues/NIMBUS-223/feature.md; verify `LayoutComposer`
  preference persistence and widget injection for custom zone prefixes first."

## 2026-10-23 — scoper

- Outcome: `scope.md` written (Story, presentation only, no behaviour change). Verified from
  installed Medusa 2.21.2 source and the Medusa docs: `LayoutComposer` is documented (since 2.16),
  arrangements persist server-side in Medusa's settings module per page key and admin user (any
  key accepted) with a shared default, custom widget zones are accepted (build warning only).
  Approach is feasible. One runnable probe remains UNVERIFIED (import from
  `@medusajs/dashboard/components` in our Admin build). Manage quote proposed out of scope.
  Not recorded in Jira yet (waits for scope approval).
- Next owner: Klaus, to answer the scope's open questions and approve the scope.
- Handover prompt: "Review issues/NIMBUS-223/scope.md and answer its open questions; on approval,
  record 'scope approved' in Jira, then decide separately on handing off to implementation-planner."

## 2026-10-23 — scope approved

- Outcome: Klaus approved the scope. Answers: the Business Central warning on Company details is a
  movable, hideable section (changed from the proposal); all other proposals accepted (priority
  Should, any admin may "Save for everyone", section split as proposed, Manage quote out of scope,
  standard widget places, Medusa's standard spacing). `scope.md` updated. NIMBUS-223 parent set to
  NIMBUS-123; Jira comment added (rules, decisions, Manage quote removed from the acceptance
  criteria) and moved to Estimation via "Scope approved".
- Next owner: Klaus (separate go-ahead for `implementation-planner`).
- Handover prompt: "Plan NIMBUS-223 from issues/NIMBUS-223/scope.md; run the LayoutComposer
  build-and-run probe first."
