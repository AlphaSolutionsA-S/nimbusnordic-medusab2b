# NIMBUS-250 progress

## 2026-10-26 — Registered

- Outcome: bug registered in Jira (Bug, parent epic NIMBUS-206, component Customer Portal) and
  mirrored in `bug.md`. Found when the storefront `product-tabs` tests failed after a lockfile
  reinstall during NIMBUS-162; the cause was traced to an undeclared `@radix-ui/react-accordion`
  resolving to a React 18 copy. Not yet checked whether a production build is affected.
- Next owner: triage, to route it (likely quick-fix: storefront only, cause known).
- Handover prompt: "Triage NIMBUS-250 (issues/NIMBUS-250/bug.md): storefront product tabs resolve an
  undeclared @radix-ui/react-accordion bound to React 18."

## 2026-10-26 — Triaged

- Outcome: proposed `quick-fix`, bug mode. Jira: Bug, status Scoping, now assigned to Klaus Petersen;
  component `Customer Portal` present. No status change: the workflow offers only Closed, Park issue
  and Scope approved (to Estimation) from Scoping, so there is no in-progress step.
- Decided by: storefront only; cause traced (undeclared `@radix-ui/react-accordion`); no data model,
  auth, payment or contract change. The fix declares a package the storefront already resolves; the
  React 19 variant of `@radix-ui/react-accordion@1.2.2` is already in `pnpm-lock.yaml` (via
  `radix-ui@1.1.2`), so it adds a direct dependency entry but no new package. Not a "simple fix"
  under `ai/AGENTS.md` for that reason, and quick-fix confirmation is "always" anyway.
- Code area: `apps/storefront/src/modules/products/components/product-tabs/accordion.tsx` and also
  `apps/storefront/src/modules/store/components/refinement-list/options-picker/index.tsx` (same
  undeclared import, store page filters); `apps/storefront/package.json`; `pnpm-lock.yaml`.
- Could push it larger: if other undeclared imports turn up across apps, or a production build is
  shown to bundle the React 18 copy and needs a deploy-side check.
- Next owner: quick-fix (after Klaus's go-ahead).
- Handover prompt: "Quick-fix NIMBUS-250. Case folder: `issues/NIMBUS-250`. Mode: bug. Triage notes:
  storefront imports `@radix-ui/react-accordion` without declaring it, in `product-tabs/accordion.tsx`
  and `store/components/refinement-list/options-picker/index.tsx`; it resolves to the React 18.3.1
  variant (backend Admin's) instead of the React 19.0.5 variant already in the lockfile. Reproduce
  with the steps in `bug.md`, declare the package in `apps/storefront/package.json` at the locked
  1.2.2 range, check the storefront for other undeclared imports, and verify the product-tabs tests
  pass after a frozen-lockfile install."

## 2026-10-26 — Quick-fix: reproduced, plan awaiting confirmation

- Outcome: reproduced on `develop` (1dcbfb5): product-tabs tests fail 2/2 with "A React Element from
  an older version of React was rendered". Root cause confirmed (`analysis.md` not yet written: the
  subagent harness blocked the file; its text is in the quick-fix report to the main session): the undeclared
  `@radix-ui/react-accordion` resolves the root hoisted copy bound to `react@18.3.1`. A scan of all
  storefront bare imports found no other undeclared package. No full-pipeline signal; stays quick-fix.
  Short plan in `task.md`. No code changed, no branch created, Jira not yet updated.
- Next owner: Klaus Petersen, to confirm `task.md` (quick-fix confirmation: always); then quick-fix
  continues from step 6 (branch `feature/NIMBUS-250`, tdd-worker, code-reviewer, local commit).
- Handover prompt: "Continue quick-fix NIMBUS-250 from step 6: task.md is confirmed<, with changes: …>."

## 2026-10-26 — Quick-fix done (local commit, not pushed)

- Outcome: Klaus confirmed task.md as written. On `feature/NIMBUS-250`, `@radix-ui/react-accordion`
  `^1.2.2` declared in the storefront; lockfile gains only the storefront importer entry (existing
  React 19 variant). Product-tabs tests 2/2 after a frozen-lockfile install; typecheck and lint at
  baseline; review approved. Full storefront suite 593/595 (two unrelated text-lookup failures, see
  `change-report.md`). Jira: "quick-fix started" comment added; status unchanged (no in-progress
  transition from Scoping).
- Next owner: Klaus Petersen: approve the push, then the after-deploy check in `change-report.md`
  (product page tabs, no React error in the console). Jira's move to review waits for a transition
  that exists from Scoping.
- Handover prompt: "NIMBUS-250 is committed locally on feature/NIMBUS-250; push and open the PR to
  develop, then run the after-deploy check in issues/NIMBUS-250/change-report.md."
