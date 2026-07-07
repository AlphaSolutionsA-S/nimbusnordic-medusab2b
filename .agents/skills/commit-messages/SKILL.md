---
name: commit-messages
description: "Use when committing code, staging changes, running `git commit`, or preparing commit messages. Enforces the Nimbus Nordic commit-message convention."
---

# Commit Message Convention — Nimbus Nordic

Every commit message MUST follow the format below.

## Format

```
NIMBUS-<number>|chore: <concise description>
```

Where `NIMBUS-<number>|chore` is either:

- An issue key from **any** configured tracker (e.g. `NIMBUS-42`), **or**
- `chore` for work that genuinely has no tracked issue.

> If this project is wired to more than one tracker, a key from **any** of them is valid. Pick the tracker that actually owns the work (e.g. a support tracker for a support fix, the development tracker for feature work).

## Rules

- Subject line ≤ 72 characters.
- Imperative mood ("Add", "Fix", "Remove") — never "Added", "Fixes", "Removed".
- Never commit without confirming the issue reference if one exists.
- Multi-issue commits: use the primary issue in the subject, mention the others in the body.

## Lookup workflow

If the issue is not obvious from the conversation, refer to the issue-tracker skill installed for this project (e.g. `jira-workflow`, `azure-devops-workflow`, `linear-workflow`, `github-issues-workflow`). Do not guess an issue key.

## Anti-patterns

- Committing without a tracker reference when one is available.
- Guessing an issue key instead of searching.
- Bypassing the convention with `--no-verify`.

## Staging workflow

- **Never** use `git add -A` or `git add .` unless the user explicitly tells you to.
- Stage only the specific files you know were changed as part of the task.
- Before committing, confirm the issue key with the user — do not assume based on context alone.
