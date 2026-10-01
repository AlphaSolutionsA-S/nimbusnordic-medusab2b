---
name: commit-messages
description: "Use when committing code, staging changes, running `git commit`, or preparing commit messages. Enforces the Nimbus Nordic commit-message convention."
---

# Commit Message Convention — Nimbus Nordic

Every commit message follows this format:

```
NIMBUS-<number>: <concise description>
```

The prefix is either an issue key from any configured tracker (e.g. `NIMBUS-42`), or `chore` for work that genuinely has no tracked issue. When the project has more than one tracker, use the one that owns the work (a support tracker for a support fix, the development tracker for feature work).

## Rules

- Subject line ≤ 72 characters.
- Imperative mood ("Add", "Fix", "Remove"), never "Added", "Fixes", "Removed".
- Multi-issue commits: the primary issue in the subject, the others in the body.
- Never bypass the convention with `--no-verify`.
- Don't guess an issue key. If it is not obvious from the conversation, find it as `tracker-workflow` § B says (context, the tracker's search, or ask).
- Interactive commits: confirm the issue key with the user before committing, even when context suggests one, and don't commit without a tracker reference when one exists.
- During a pipeline run, the task-dispatcher, committer and quick-fix use the task's issue key from the manifest, else the case key, both agreed at the plan gate, without asking.

## Staging

- Never use `git add -A` or `git add .` unless the user explicitly tells you to.
- Stage only the files you know were changed as part of the task.
