---
name: code-review
description: "Use when reviewing a pull request, a diff, a patch, or staged changes for Nimbus Nordic. Applies the Alpha code-review checklist."
argument-hint: "PR URL, branch name, or path to a diff"
---

# Code Review Checklist — Nimbus Nordic

Inside the pipeline, the code-reviewer and integration-reviewer agents do the per-task and whole-branch review; this checklist is for reviewing pull requests (including the branch the pipeline produced), pasted patches, your own staged changes before pushing, and for teams not using the pipeline.

Apply it on every review. Block the merge on any Must item; flag Should items as comments.

## Procedure

### Step 1 — Frame the change

1. Read the linked issue. Don't review a PR with no tracker reference unless told it is a `chore`.
2. State in one line what the change should do.
3. Skim the diff start to end before commenting: context first, line by line second.

### Step 2 — Walk the checklist

Correctness (Must)

- [ ] The change implements the stated objective.
- [ ] Edge cases (empty, null, large, concurrent, unicode, timezone) are handled.
- [ ] Error paths are handled, not just the happy path.
- [ ] New public APIs and DB migrations are backwards compatible, or the breakage is intentional and documented.
- [ ] The PR description quotes evidence that the change works at the tier the change requires (`prove-it-works`, if installed); a claim it forbids ("tested locally", "should work") is a `must:` comment.

Security (Must)

- [ ] No open OWASP Top 10 violation in the diff, per the checklist and rules of `secure-coding-owasp` (secrets and PII, input validation, injection, authZ on every new endpoint, dependencies). An open one is a `must:`.

Tests (Must)

- [ ] New behaviour has automated tests at the right level (unit, integration, e2e).
- [ ] Bug fixes include a regression test that fails without the fix, even for a one-line change.
- [ ] Tests assert behaviour, not implementation; no `assert true` placeholders.

Readability and maintainability (Should)

- [ ] Names describe intent; no `data2`, `tempFix`, `handlerHandlerHandler`.
- [ ] Functions do one thing; nesting depth ≤ 3; cyclomatic complexity reasonable.
- [ ] Linter and formatter clean.
- [ ] Comments follow the comment rule in `ai/AGENTS.md`.
- [ ] No `TODO` or `FIXME` added without a tracked follow-up.
- [ ] Dead code, commented-out blocks, and stray `console.log` / `Debug.WriteLine` or other debug prints removed.

Architecture (Should)

- [ ] Respects existing module boundaries; no cross-layer leaks.
- [ ] No premature abstraction ("rule of three") and no copy-paste duplication.
- [ ] Public surface area increased only when justified.

Performance (Should, only when it matters)

- [ ] No N+1 queries on hot paths.
- [ ] No unbounded loops, allocations, or external calls inside request handlers.

Operability (Should)

- [ ] Logs at appropriate levels; structured where the project uses structured logging.
- [ ] Feature flags and config defaults are safe.
- [ ] Migrations are reversible or have a documented forward-only plan.
- [ ] Dependency lockfile updated and committed if dependencies changed.

Documentation (Should)

- [ ] README, runbook or ADR updated if behaviour, operations or architecture changed.
- [ ] Public API docs updated.

### Step 3 — Comment style

- Prefix each comment so the author can scan: `must:`, `should:`, `nit:`, `question:`, `praise:`.
- One topic per comment.
- Suggest a concrete fix when you can ("Try `Result.unwrap_or_else(...)` here.") and explain the problem rather than rewriting the author's code.
- Keep to the PR's scope: file a follow-up issue for unrelated refactors instead of demanding them.
- Correctness and security come before style.
- Approve only after reading the whole diff and walking the checklist, and only when every `must:` is resolved.

### Step 4 — Wrap up

Summarise in one short message:

> Reviewed. 2 must-fix (security + missing test), 4 should-fix, otherwise clean. Approving once the 2 must-fix are addressed.

## References

`prove-it-works` (what counts as evidence), `secure-coding-owasp` (security checks), `commit-messages` (commit reference rules), and `tracker-workflow` (issue linkage).
