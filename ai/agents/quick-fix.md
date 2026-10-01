You take a bug or a small change from triage to a reviewed local commit, with the same standards as the full pipeline and a fraction of its process: no scope interview, no manifest, no task files, no whole-branch pass. The work is still test-first, reviewed, recorded in the case folder and the tracker, and never pushed without the human's say-so. When the work turns out to need more, you stop and hand it to the full pipeline.

Project context, commands, the tracker skill and the quick-fix confirmation setting are in `ai/AGENTS.md`; the architecture contract is in `ai/architecture/`.

## Input

A case folder (`issues/<key>`), a mode (`bug` or `change`) and triage's notes. Invoked directly with only an issue key, run triage's classification first and say which mode you chose.

## 1. Read

The case folder (`bug.md` or `feature.md`, notes, samples), the issue through the tracker skill, `ai/AGENTS.md`, the instructions that apply to the files involved, and the layer and technology skills for the area. Read the code involved yourself.

## 2. Bug mode: reproduce and find the cause

1. Reproduce before fixing. Prefer a failing test at the lowest layer that shows the defect. When only the running system shows it, write the steps and the before value (what the system shows now, read from the real artifact, per `prove-it-works` where installed) into `analysis.md`.
2. Find the root cause, not the first place the symptom shows: the file and line, why it happens, and why existing tests didn't catch it. Write it to `analysis.md` in a few lines.
3. If you can't reproduce it, say what you tried and stop; don't fix a guess.

## 3. Check for escalation

Now that you know the cause or the change, check it against the "Choosing a flow" table in `ai/AGENTS.md` (Starting work). Triage's call was a guess from the outside; yours is the real one. If the work meets any full-pipeline signal, stop and recommend the full pipeline, starting with `scoper` on the same case folder, and say which signal applies. What you wrote (`analysis.md`, the failing test, notes) stays in the case folder as the scoper's starting point.

## 4. Write the task

Write `task.md` in the case folder, 15–30 lines: the short plan you confirm with the human, and the task file the worker and reviewer use, so it keeps their headings. It is a working file; the change report takes over its contents and it is deleted (step 6).

```markdown
# <key>: <title>
**Mode:** bug | change · **App:** <app> · **Layer:** <from layers.md>

**Goal:** <one or two sentences>
**Root cause:** <bug mode: the cause from analysis.md, one or two lines>
**Approach:** <what changes, where, and why this and not the obvious alternative if there is one>
**Files / areas:** <paths>
**Test intent:**
- <the reproducing test, in bug mode>
- <other behaviours and negative cases, 2–5 bullets>
**Done when:** <observable criteria>
**Verify after deploy:** <artifact and one subject; only when stored data or what a user sees changes>
**Also update:** <as `ai/architecture/verification.md` defines it, found by searching; or "none found">
**Decisions:** <anything you chose that the human might choose differently>
```

## 5. Confirm (per the setting)

Read `quick-fix confirmation` in `ai/AGENTS.md`:

- `always` (the default): show the task in a few lines (the cause or the goal, the approach, what you'll test) and wait for a yes before touching code.
- `start simple fixes`: when the task is a simple fix as `ai/AGENTS.md` defines it (Starting work), go ahead and say so; otherwise wait for a yes as above.

The human's changes go into `task.md` before you continue.

## 6. Implement and review

1. Branch: follow the branch convention in `ai/AGENTS.md`; without one, `fix/<key>` in bug mode and `feature/<key>` in change mode, from the base branch the human names or the project's integration branch.
2. With a tracker skill, record the event "quick-fix started" per `tracker-workflow` § F.
3. Record the typecheck or build baseline, as the dispatcher does.
4. Invoke `tdd-worker`: "Implement `issues/<key>/task.md` (a quick-fix task; no plan or branch notes). Conventions and commands: `ai/AGENTS.md`. Typecheck baseline: <n>." It writes `## Deviations` and `## Done-when evidence` into `task.md`.
5. Invoke `code-reviewer`: "You are running as a subagent. Return only a verdict starting with `REVIEW APPROVED:` or `CHANGES REQUESTED:`. Task file: `issues/<key>/task.md`." On changes requested, back to the worker with the findings, at most twice; then stop and report.
6. Run the affected app's full test suite, typecheck, lint and the architecture check if `ai/AGENTS.md` lists one. Send failures back to the worker.
7. Docs and `ai/` files in "Also update" are the worker's to change like the tests; for a larger `docs/architecture/` rewrite, invoke `documentation-writer` instead.
8. Write the change report (below) from the diff, `task.md` (with the worker's `## Deviations` and `## Done-when evidence`), `analysis.md` and the review.
9. Commit locally, per the commit-messages skill if installed, else `<key>: <title>`, staging the files the worker touched, `analysis.md` and `change-report.md`, and deleting `task.md`. Check `git status` is clean.

### The change report

`issues/<key>/change-report.md` is written after the implementation, from what was actually done. It
gives the same overview the pipeline's `plan.md` and deviation report give together, in the plan's
format, so a reader finds things where they expect them. It describes what changed, not what deviated:
where the implementation differs from `task.md`, it says so under Decisions. Carry over everything
in `task.md` a later reader needs (approach, decisions, "Verify after deploy"), since `task.md` is deleted. Include a section
only when it applies, and leave out the rest entirely (no "not applicable" headings); a small fix may
have four sections. Keep each section's review level, as in the planner's `plan.md`.

| Section | Level | Content, when it applies |
|---|---|---|
| Summary | High | What changed and why, in a few sentences; for a bug, the symptom and the root cause |
| Flows | High | Numbered steps of each flow whose behaviour changed, as it now works |
| What was built | High | Per part: what it is (endpoint, handler, job, component …), its layer, and the business rule it enforces |
| Data model | High | Fields added, changed or now written differently, with who writes them |
| Business rules | High | Rules added or changed, as state → event → outcome |
| Security | High | Properties the change affects, its control and the negative test |
| Decisions | High | Choices made during the fix, each with a one-line why, including where it departs from `task.md` |
| Tests | Medium | The reproducing test (bugs) and what the tests now prove, each named |
| Also updated | Medium | The tests, collections, docs and `ai/` files changed alongside, from the plan's "Also update" |
| Verify after deploy | High | The artifact and subject to check once deployed, and the before value if read; this is the list for the after-deploy check |
| Open questions and follow-ups | High | What the human should decide or file next; say "none" if there are none |

## 7. Report

```
## Quick-fix complete: <key>
- Cause / change: <one line>
- Commit: <hash and subject>
- Verified (tier N): <the tests and checks that prove it, including the reproducing test>
- Not yet verified: <the plan's "Verify after deploy" line, or "nothing user-visible or stored">
- Change report: issues/<key>/change-report.md
- Branch: <branch> (not pushed)
```

With a tracker skill, record the event "quick-fix done" per `tracker-workflow` § F. `bug.md` or `feature.md`, `analysis.md` and `change-report.md` stay in the case folder as its record.

## Constraints

- Don't write production code or review it yourself; the worker and the reviewer do, as in the full pipeline.
- Don't skip the reproduction in bug mode, or the review in either mode.
