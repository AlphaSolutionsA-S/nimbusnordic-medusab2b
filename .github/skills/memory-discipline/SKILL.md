---
name: memory-discipline
description: "Use whenever you are about to write to agent memory (Copilot, Claude, Cursor user/global memory). Enforces that project-specific facts live in the repo where the team can see them, not in private per-developer memory."
---

# Memory Discipline â€” Nimbus Nordic

Agent memory tools (user-scope, global, "remember this") are **per-developer and invisible to the rest of the team**. Anything stored there silently overrides whatever the project actually says â€” and only for the one developer whose machine wrote it.

This skill defines where information is allowed to live.

## When this skill applies

- The agent is about to call any "save to memory", "remember", or user-scope memory write operation.
- The user says "remember that â€¦", "save this for next time", "make a note that â€¦".
- You discover a project-specific convention (ticket prefix, folder layout, naming rule, build command, deployment quirk).

## The rule

| Information | Lives in | Why |
|---|---|---|
| **Per-case** notes, analysis, repro data, plans | `issues/<caseid>/` (PLAN.md, ANALYSIS.md, notes.md, samples/, logs/) | Mirrors the tracker case; reviewable in PRs; survives developer turnover |
| **Repo-wide** conventions, build commands, deployment quirks, agent rules | `AGENTS.md`, `.github/copilot-instructions.md`, `CLAUDE.md`, or an installed skill (`.github/skills/`, `.claude/skills/`, `.cursor/rules/`) | One source of truth, version controlled, visible to every teammate and every harness |
| **Repo-scoped working notes** for *this clone only* (e.g. local TODOs while exploring) | Repo-scoped memory (`/memories/repo/` if your harness supports it) | Stays with the workspace; doesn't pollute user memory |
| **Cross-project agent ergonomics** (e.g. "I prefer concise answers") | User-scope memory | Genuinely personal; not project knowledge |

## Hard rules

- **Never write a customer name, ticket prefix, repo path, branch name, build command, or workflow convention into user-scope / global memory.** It will silently override the next project the developer opens.
- **Never use memory to remember information that another teammate would need to know.** If they would need it, it belongs in the repo.
- When the user says "remember X", first ask: *does this apply to this project only, or to me everywhere?* If project-only â†’ write it to the repo; if everywhere â†’ user memory is fine.
- If you find an existing user-memory note that encodes project-specific facts, surface it and offer to move the content into the repo (skill, `AGENTS.md`, or `issues/<caseid>/`).

## Procedure

### Step 1 â€” Classify the information

Decide which row of the table above it fits. If you cannot answer "would a new teammate cloning this repo need to know this?" â€” assume yes, and write it to the repo.

### Step 2 â€” Pick the destination

- Per-case â†’ `issues/<caseid>/<file>.md`
- Repo convention â†’ the matching installed skill, or `AGENTS.md` if no skill owns it
- Per-clone ephemeral â†’ repo-scoped memory (if available)
- Truly personal preference â†’ user-scope memory

### Step 3 â€” Write it there, commit if applicable

Files under `issues/<caseid>/` and `AGENTS.md` must be committed in the same change that captured the knowledge. Memory writes are never a substitute for a commit.

### Step 4 â€” Confirm to the user

State explicitly where you wrote it and why, e.g.:

> Saved to `issues/lp-1234/notes.md` (project-specific, belongs in the repo so the team can see it) rather than user memory.

## Anti-patterns

- "I'll remember that for you" â†’ followed by a user-memory write containing a ticket prefix, repo path, or build command.
- Storing the customer's JIRA project key, branch policy, or coding convention in personal memory.
- Treating memory as a faster alternative to editing `AGENTS.md` or an installed skill.
- Keeping per-case investigation notes only in memory instead of `issues/<caseid>/`.
- Letting an old, project-specific user-memory note silently shape behaviour on a different customer's repo.

## References

- The installed tracker workflow skill defines `<caseid>` (`jira-workflow`, `azure-devops-workflow`, `linear-workflow`, `github-issues-workflow`).
- `bug-reporting` and `feature-requests` write into the same `issues/<caseid>/` root.

