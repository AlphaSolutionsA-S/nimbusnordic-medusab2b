---
name: definition-of-done
description: "Use when closing an issue, marking work complete, opening a PR, or asking 'is this done?' for Nimbus Nordic. Enforces the Alpha Definition of Done."
argument-hint: "Issue key or PR reference"
---

# Definition of Done — Nimbus Nordic

A change is **Done** only when every item below is true. If any item cannot be satisfied, surface it explicitly and leave the issue open (or request a documented exception).

## When this skill applies

- About to transition an issue to a "done" state (Done, Closed, Resolved, Merged).
- About to mark a PR as ready for review or merge.
- The user asks "is this ready?", "can we close this?", "is this done?".

## Definition of Done — Checklist

### 1. Scope

- [ ] All acceptance criteria from the issue are met.
- [ ] Scope creep is split into a follow-up issue rather than smuggled in.

### 2. Code

- [ ] Code follows the project style (linter / formatter clean).
- [ ] No `TODO`, `FIXME`, or commented-out code added without a tracked follow-up.
- [ ] No secrets, tokens, or customer data committed.
- [ ] OWASP Top 10 review applied where relevant (see `secure-coding-owasp` if installed).

### 3. Tests

- [ ] Automated tests cover the new behaviour at the appropriate level.
- [ ] Bug fixes include a regression test that fails without the fix.
- [ ] Full test suite passes locally and in CI.

### 4. Build & CI

- [ ] Build is green on the target branch.
- [ ] No new lint warnings or compiler warnings introduced.
- [ ] Dependency lockfile updated and committed if dependencies changed.

### 5. Review

- [ ] At least one peer review approval (see `code-review` if installed).
- [ ] All `must:` review comments resolved.

### 6. Documentation

- [ ] README, runbook, or ADR updated if behaviour, operations, or architecture changed.
- [ ] Public API documentation updated.
- [ ] Repo-side `issues/<id>/PLAN.md` reflects the final approach and verification steps.

### 7. Operability

- [ ] Logs are at appropriate levels; no `console.log` / debug prints left behind.
- [ ] Feature flags default to the safe value.
- [ ] Database migrations are reversible or have a documented forward-only plan.
- [ ] Monitoring / alerts updated if the change introduces a new failure mode.

### 8. Tracker hygiene

- [ ] Issue is linked to the merging PR / commit.
- [ ] Issue status transitioned to the project's "done" state.
- [ ] Time tracking / effort fields updated if the project uses them.
- [ ] Stakeholders notified if the change is user-visible.

### 9. Deployment (if applicable)

- [ ] Change deployed to the target environment.
- [ ] Smoke-test executed post-deploy.
- [ ] Rollback plan documented if the deploy is risky.

## Procedure

1. Walk the checklist in order.
2. For each unchecked item, decide: **block** (must fix), **defer** (file a follow-up issue and link it), or **waive** (require explicit user approval and record the waiver in the issue).
3. Only after every item is resolved, transition the issue and confirm to the user:

   > `{ISSUE-KEY}` meets Definition of Done. Closed.

## Anti-patterns

- Marking an issue done because the code merged, ignoring docs / tests / ops.
- Closing the issue and silently opening 3 follow-up issues that should have been in scope.
- Skipping the regression test on a bug fix because "it's a one-line change".
- Treating a green CI as proof of correctness without a peer review.

## References

- `code-review` (review checklist)
- `secure-coding-owasp` (security gate)
- The tracker workflow skill (issue transitions)
