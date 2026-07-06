---
name: code-review
description: "Use when reviewing a pull request, a diff, a patch, or staged changes for Nimbus Nordic. Applies the Alpha code-review checklist."
argument-hint: "PR URL, branch name, or path to a diff"
---

# Code Review Checklist â€” Nimbus Nordic

Apply this checklist on every review. Block the merge on any **Must** item; flag **Should** items as comments.

## When this skill applies

- Reviewing a pull / merge request.
- Reviewing a patch or diff a teammate pasted into chat.
- Self-reviewing your own staged changes before pushing.

## Procedure

### Step 1 â€” Frame the change

1. Read the linked issue (do **not** review a PR with no tracker reference unless explicitly told it is a `chore`).
2. State in one line what the change *should* do.
3. Skim the diff start-to-end before commenting â€” context first, line-by-line second.

### Step 2 â€” Walk the checklist

**Correctness (Must)**

- [ ] Does the change actually implement the stated objective?
- [ ] Are edge cases (empty, null, large, concurrent, unicode, timezone) handled?
- [ ] Are error paths handled â€” not just the happy path?
- [ ] Are new public APIs / DB migrations backwards compatible, or is the breakage intentional and documented?

**Security (Must â€” see `secure-coding-owasp` if installed)**

- [ ] No secrets, tokens, or PII in code, logs, or fixtures.
- [ ] User input validated at the trust boundary; parameterised queries; safe templating.
- [ ] AuthZ checked on every new endpoint / handler.
- [ ] No insecure dependency added; lockfile updated.

**Tests (Must)**

- [ ] New behaviour has automated tests at the right level (unit / integration / e2e).
- [ ] Bug fixes include a regression test that fails without the fix.
- [ ] Tests assert behaviour, not implementation; no `assert true` placeholders.

**Readability & maintainability (Should)**

- [ ] Names describe intent; no `data2`, `tempFix`, `handlerHandlerHandler`.
- [ ] Functions do one thing; nesting depth â‰¤ 3; cyclomatic complexity reasonable.
- [ ] Comments explain *why*, never *what*.
- [ ] Dead code, commented-out blocks, and stray `console.log` / `Debug.WriteLine` removed.

**Architecture (Should)**

- [ ] Change respects existing module boundaries; no cross-layer leaks.
- [ ] No premature abstraction ("rule of three") and no copy-paste duplication.
- [ ] Public surface area increased only when justified.

**Performance (Should â€” only when it matters)**

- [ ] No N+1 queries on hot paths.
- [ ] No unbounded loops, allocations, or external calls inside request handlers.

**Operability (Should)**

- [ ] Logs at appropriate levels; structured where the project uses structured logging.
- [ ] Feature flags / config defaults are safe.
- [ ] Migrations are reversible or have a documented forward-only plan.

**Documentation (Should)**

- [ ] README / runbook / ADR updated if behaviour or operations changed.
- [ ] Public API docs updated.

### Step 3 â€” Comment style

- Use prefixes so the author can scan: `must:`, `should:`, `nit:`, `question:`, `praise:`.
- One topic per comment; avoid wall-of-text threads.
- Suggest a concrete fix when you can ("Try `Result.unwrap_or_else(...)` here.") rather than only flagging the problem.
- Approve only when every `must:` is resolved.

### Step 4 â€” Wrap up

Summarise in one short message:

> Reviewed. 2 must-fix (security + missing test), 4 should-fix, otherwise clean. Approving once the 2 must-fix are addressed.

## Anti-patterns

- Approving a PR you didn't actually read end-to-end.
- "LGTM" with no evidence you walked the checklist.
- Bikeshedding style while ignoring a correctness or security issue.
- Demanding refactors unrelated to the PR's scope â€” file a follow-up issue instead.
- Rewriting the author's code in review comments instead of explaining the problem.

## References

- `secure-coding-owasp` (security checks)
- `commit-messages` (commit reference rules)
- The tracker workflow skill (issue / work item linkage)

