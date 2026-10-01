---
name: memory-discipline
description: "Use whenever you are about to write to agent memory (Copilot, Claude, Cursor user/global memory). Enforces that project-specific facts live in the repo where the team can see them, not in private per-developer memory."
---

# Memory discipline — Nimbus Nordic

Agent memory (user-scope, global, "remember this") is per-developer and invisible to the rest of the team. Anything stored there silently overrides what the project says, and only for the one developer whose machine wrote it. This applies to any memory write, to "remember that …", "save this for next time" or "make a note that …", and whenever you discover a project-specific convention (ticket prefix, folder layout, naming rule, build command, deployment quirk).

## Where information lives

| Information | Lives in | Why |
|---|---|---|
| Per-case notes, analysis, repro data, plans | The case folder `issues/<key>/` ("Case folders" in the project's `ai/AGENTS.md`): `notes.md`, `analysis.md`, `samples/`, `logs/`, `plan.md` | Mirrors the tracker case; reviewable in PRs; survives developer turnover |
| Repo-wide conventions, build commands, deployment quirks, agent rules | The shared AI base: `ai/AGENTS.md`, `ai/architecture/`, or a skill or instruction under `ai/`. Never the tool stubs (`.github/`, `.claude/`, root `AGENTS.md`); they point at `ai/` and are regenerated | One source of truth, version controlled, visible to every teammate and every harness |
| Repo-scoped working notes for this clone only (e.g. local TODOs while exploring) | Repo-scoped memory (`/memories/repo/` if your harness supports it) | Stays with the workspace; doesn't pollute user memory |
| Cross-project agent ergonomics (e.g. "I prefer concise answers") | User-scope memory | Genuinely personal; not project knowledge |

## Rules

- Never write a customer name, ticket prefix, repo path, branch name, build command or workflow convention into user-scope or global memory: it silently overrides the next project the developer opens. Treating memory as a faster alternative to editing `ai/AGENTS.md` or a skill is the usual way this happens.
- Never use memory for information another teammate would need; that belongs in the repo.
- When the user says "remember X", ask whether it applies to this project only or to them everywhere. Project-only goes to the repo; everywhere may go to user memory.
- If you find an existing user-memory note that encodes project-specific facts, surface it and offer to move its content into the repo (a skill, `ai/AGENTS.md`, or the case folder). An old note like that otherwise shapes behaviour on a different customer's repo.
- In a pipeline run agents write no memory: case facts go in the case folder, and a convention worth adding to `ai/`, or a project-specific memory note found, is raised for the human to decide at the gate.

## Procedure

1. Classify the information by the table. If you cannot answer "would a new teammate cloning this repo need to know this?", assume yes and write it to the repo.
2. Pick the destination:
   - Per-case: `issues/<key>/notes.md`, `analysis.md` or another case file.
   - Repo convention: the matching skill under `ai/skills/`, or `ai/AGENTS.md` if no skill owns it.
   - Per-clone ephemeral: repo-scoped memory, if available.
   - Truly personal preference: user-scope memory.
3. Write it there. Files under `issues/<key>/` and `ai/` are committed in the same change that captured the knowledge; a memory write is never a substitute for a commit.
4. Tell the user where you wrote it and why (in a pipeline run, in your summary), e.g.:

   > Saved to `issues/LP-1234/notes.md` (project-specific, belongs in the repo so the team can see it) rather than user memory.

## References

- "Case folders" in the project's `ai/AGENTS.md` defines `<key>` and the case files.
- `bug-reporting` and `feature-requests` write into the same `issues/<key>/` root.
