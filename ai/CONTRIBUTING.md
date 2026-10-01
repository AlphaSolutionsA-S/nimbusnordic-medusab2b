# Contributing to the AI base

Content lives once, in `ai/`. Each tool reads it through a thin pointer stub: a small committed
file with that tool's frontmatter and a one-line reference into `ai/`. There is no build step. The
only generated content is the `context`, `always` and `tier0` blocks in root `AGENTS.md` and the
`context` and `tier0` blocks in `.github/copilot-instructions.md` (Copilot gets always-on
instructions through `applyTo: "**"`), which `pnpm ai:check --fix` rewrites.

## Rules

- Edit content under `ai/` only. Touch a stub only to change a tool's frontmatter (tools, model) or
  to add or remove one. Never hand-edit a generated block.
- Run `pnpm ai:check` after any change to `ai/`, and commit the stubs with the content.
- Treat skill and Tier 0 edits as part of the code change that makes them necessary; a skill that
  describes code that no longer exists misleads every agent that loads it.

## What goes where

| If it is … | Put it in |
|---|---|
| needed by every agent on every task (layers, boundaries, data ownership, test rules, rule index) | `ai/architecture/` (Tier 0), within the ~300-line budget |
| project context, commands, standing policies | `ai/AGENTS.md` |
| how to do one kind of work (a layer, a framework, a vendor, a process) | a skill: `ai/skills/<name>/SKILL.md`, detail in `reference/` |
| a convention for one area or file type | an instruction: `ai/instructions/<name>.md` |
| a pipeline role | an agent: `ai/agents/<name>.md` (harness-owned; see below) |

A rule that a linter, analyzer or test can enforce goes there, and the skill only explains it.

## Ownership and upgrades

`ai/harness.lock.json` records which files came from the shared harness. On an upgrade:

| Owner | Files | Upgrade behaviour |
|---|---|---|
| `harness` | agent bodies, `ai/tools/ai-check.*`, this file | replaced if unchanged here; merged with you if you changed them |
| `catalog` | skills and instructions installed from the catalog, and skills you contributed to it (not their `project.md`) | re-rendered with your answers; merged if you changed them |
| `generated` | stubs, entry-file headers, generated blocks | regenerated |
| `project` | `AGENTS.md` context, Tier 0, layer skills written from the template, path instructions, every `ai/skills/<id>/project.md` | never overwritten; the upgrade proposes edits |

Files not in the lock, including your own skills, agents and instructions, are never touched. Prefer adding over editing harness files: a
project-specific review rule belongs in `ai/architecture/rules.md`, a command in `ai/AGENTS.md`, not
in an agent body.

## Adding a skill

0. Check the shared catalog first when `harness_released` in `ai/harness.json` is more than a month
   old (or you have never looked): someone may have written the skill since this project was set up.
   With a local clone of `harness_repo` (ask where it is; otherwise clone it, which needs Bitbucket
   access), pull it and look in `catalog.yaml` and `skills/` for the technology. If it's there,
   install it with the bootstrap's Add-a-skill mode (`bootstrap/BOOTSTRAP.prompt.md` in that repo)
   instead of writing a new one; if the harness itself is newer, suggest an upgrade too.
1. Create `ai/skills/<name>/SKILL.md` with single-line `name` and `description` frontmatter, and any
   `reference/` files. For a layer skill, start from the `_layer-template` shape: responsibility,
   allowed dependencies, forbidden rule IDs, one canonical example from this repo, a checklist. For a
   framework or vendor skill, write it contribution-ready: the generic knowledge in `SKILL.md`
   (verified against the installed version, ending with a "Project specifics" section that points to
   `project.md`) and this project's paths, examples and exceptions in `project.md`. If the vendor
   offers an MCP server (documentation, API signatures, the service itself), tell the person you're
   writing the skill with: it can be added to the project's MCP config (`.mcp.json`,
   `.vscode/mcp.json`) and named in the skill as where its signatures are checked.
2. Add a stub per enabled tool with the same `name` and `description` and a body pointing at the
   source: `.claude/skills/<name>/SKILL.md`, `.github/skills/<name>/SKILL.md`,
   `.agents/skills/<name>/SKILL.md`.
3. Add a row to the Skills table in `ai/AGENTS.md`, then run `pnpm ai:check --fix`.
4. Ask whether the skill should be contributed to the shared catalog (below).

A skill installed from the catalog is catalog-owned: don't edit its `SKILL.md`. Put this project's
paths, canonical examples, exceptions and extra rules in `project.md` next to it; the catalog skill
tells agents to read it and to let it win where the two differ, and an upgrade never touches it. A
correction or addition to the generic knowledge itself belongs upstream: make it, then offer to
contribute it, so the next upgrade doesn't overwrite it.

## Contributing a skill to the shared catalog

Offer this after creating a skill or making a larger change to one (new rules, a new section, a
corrected API), whether it is the project's own skill or a catalog skill. Nothing happens without the
person's yes.

1. Separate the generic knowledge from this project's facts: paths, file names, customer and domain
   terms and business rules go to `project.md`, which is never contributed. Show what will be shared.
2. In a local clone of `harness_repo` (pulled to date), create a branch from its default branch:
   `skill/<id>` for a new skill, `skill/<id>-<short-change>` for a change to an existing one,
   `skill/<first-id>-and-more` for several in one pass.
3. New skill: copy `SKILL.md` and `reference/` to `skills/<id>/`, add `manifest.yaml` from
   `skills/_template/` (owner: the person contributing; `stack`; `detect` rules that would find the
   technology) and a `catalog.yaml` entry. Changed catalog skill: apply the change to `skills/<id>/`
   and bump the skill's version in its manifest (patch for a clarification, minor for new rules or
   sections).
4. Bump the patch version in `harness/VERSION`, set `harness/RELEASED` to today, and add a line to
   `CHANGELOG.md` under Unreleased.
5. Commit on the branch; the yes to contribute covers this commit. Pushing and opening a pull request
   are asked separately; the repository's maintainers review it. `docs/ADDING-A-SKILL.md` in that
   repo has the full checklist.
6. Here, record the skill in `ai/harness.lock.json` as catalog-owned (`"owner": "catalog"`,
   `"source": "skills/<id>"`, `"version"`: the skill's manifest version, `"hash": null`) and run
   `pnpm ai:check --stamp`, so upgrades track it.

## Adding an instruction

1. Write `ai/instructions/<name>.md` (plain markdown, no frontmatter).
2. Declare it in `ai/harness.json` under `instructions` with its glob (`**` for always on).
3. Add the stubs for each enabled tool: `.claude/rules/<name>.md` (`paths:` frontmatter unless
   always on, body `@../../ai/instructions/<name>.md`), `.github/instructions/<name>.instructions.md`
   (`applyTo:`), `<dir>/AGENTS.md` for a `<dir>/**` glob (Codex), `.cursor/rules/<name>.mdc` for a
   scoped glob (Cursor).
4. Add a row to the Instructions table, then run `pnpm ai:check --fix`.

## Adding an agent

Agent bodies are harness-owned; a new project-specific agent is fine. Write `ai/agents/<name>.md`
(plain markdown, no frontmatter), then add `.claude/agents/<name>.md` (`name`, `description`,
`model: inherit`), `.github/agents/<name>.agent.md` (Copilot frontmatter: `name`, `description`,
`model`, `tools`, optional `handoffs`) and `.codex/agents/<name>.toml` (`name`, `description`,
`developer_instructions`), all with the same description, and a row in the Agents table.

## Writing style

State each rule once, in normal case, in its natural home; add a one-clause why when the rule came
from an incident or is not obvious. No all-caps and no bold for emphasis: current models follow plain
rules closely and over-apply shouted ones. At most one example per rule, only when the rule is hard
to apply without seeing code; show a wrong/right pair only when the wrong way is the natural thing to
write. No intros, "how to use this skill" sections, closing summaries or generic advice. Cite one real
file in this repo as the canonical example rather than inventing one. Never put secrets, incident
narratives, plan or task ids, or a restatement of a lint rule in a skill.

## Size budgets

| Content | Budget |
|---|---|
| Tier 0 (`ai/architecture/`) | ~300 lines in total; `pnpm ai:check` fails above `limits.tier0_lines` |
| Root `AGENTS.md` | under 32 KiB with Codex enabled (it stops reading silently); enforced |
| Layer skill | ~150 lines |
| Technology skill | ~200 lines in `SKILL.md`, detail in `reference/` |
| Plan | ~100 lines per task across `plan.md`, manifest and task files; guidance, not a cap (the planner says why when it goes over) |

Everything always loaded is paid for on every request. To add to Tier 0 or `ai/AGENTS.md` when near a
budget, remove something first.
