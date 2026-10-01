---
name: tracker-workflow
description: "Use together with the project's tracker skill (jira-workflow, azure-devops-workflow, linear-workflow or github-issues-workflow) whenever you work with the tracker: starting work on an issue, committing, writing an issue's description or comments, registering a bug or feature (with bug-reporting or feature-requests), closing an issue, and when a pipeline agent records its change history. Holds the procedure and rules that are the same for every tracker; the tracker skill says how each step is done there."
---

# Tracker workflow

The procedure for working with the project's tracker, whichever it is. The tracker skill installed
next to this one (`jira-workflow`, `azure-devops-workflow`, `linear-workflow` or
`github-issues-workflow`) holds that tracker's settings, the key and reference formats, an
Operations table saying how each step below is done there, and its pitfalls. Where this skill says
"fetch the issue", "move it to in progress" or "create a child item", do it the way that table says.
Tool names differ between harnesses, so both skills name operations, not tool ids.

With several tracker instances, the pipeline agents use the primary one named in `ai/AGENTS.md`
(section Tracker); interactively, use the one that owns the work.

Never move an issue to its final state without first adding a closing comment (§ E). It is the most
commonly violated rule here, including when the user says "mark as done" or "close it".

## A. Starting work

Applies when the user names an issue with any action verb ("work on", "start", "pick up", "solve",
"fix", "implement"), pastes a tracker link, or switches issue, and when a new issue turns up in the
session (e.g. from a commit-message lookup) before you start changes. Don't start changes without
checking assignee and state.

1. Fetch the issue and read its assignee, state, type and title (sanity check). Report in one line,
   e.g. `PROJ-42` — Unassigned, state To Do. Type: Task.
2. If it is unassigned, assign it to the current user (resolve their identity once per session) and
   confirm. If it is assigned to someone else, say so and never reassign without asking.
3. Propose moving it to in progress unless it is already past that. Fetch the valid states or
   transitions first; names depend on the tracker's workflow.
4. Once steps 1–3 are done for an issue, treat it as checked in and skip them on later edits in the
   same session.

This section is interactive. In a pipeline run the agents make the state changes of § F instead.

## B. Commit messages

A commit references its issue by the key in the tracker skill's reference format. The message format
is the `commit-messages` skill's; without it, `<key>: <description>`.

Finding the issue:

1. Known from context: use it.
2. Unclear: search the tracker (the tracker skill's search), present the top matches and let the user
   pick. Prefer the most specific item (a story, task or bug over an epic).
3. No match: ask the user whether to create an issue (the tracker skill's creation template) or commit
   without a reference, in the no-tracker format of `commit-messages`.

## C. Descriptions and comments

- Link repo files by their full URL, `<repo URL>/blob/<default branch>/<repo-relative path>` (the
  tracker skill's settings), never a bare workspace-relative path.
- Link related issues with the tracker's own link or relation feature, not a "Related: …" line in the
  description.
- Don't rewrite a description a human wrote. Descriptions often hold pasted screenshots, and replacing
  the text can strip them (the tracker skill says how). To add information, add a comment; comments
  never touch the description. Other field edits (assignee, state, labels, links, title) are safe. If
  the user asks for a rewrite, warn about the screenshots and get explicit confirmation first.
- During a pipeline run agents add comments only; a needed rewrite goes into the deviation report's
  open questions.

## D. Repo-side documentation

The tracker is for humans: keep descriptions and comments non-technical, and put raw analysis or agent
reasoning in the repo. Technical depth (analysis, plans, data samples) lives in the issue's case
folder, `issues/<key>/`, named with the key as the tracker skill gives it and laid out as the "Case
folders" section of the project's `ai/AGENTS.md` describes.

### Intake mirror

`bug-reporting` and `feature-requests` register work on two surfaces that mirror each other one to
one: the tracker issue, for business users, PM and stakeholders, and the intake file in the case
folder (`bug.md` or `feature.md`), for engineers and agents. Create or update both when work is
reported, also when it surfaces during a session and should be captured before moving on, and link
each to the other.

1. Find the issue: ask the user, or search the tracker for a match before creating one. If one
   exists, the folder takes its key. If none exists and the user wants one, create it and use the
   returned key. If the user wants none, use a slug and say so in the intake file.
2. Write the intake file from the intake skill's template. Redact secrets, tokens and customer PII
   from screenshots, logs and samples first (`secure-coding-owasp`).
3. Mirror to the tracker only the sections the intake skill names, never the whole file, and link
   back: `Engineering detail: <repo URL>/blob/<default branch>/issues/<key>/<intake file>`, in the
   description of an issue you create, in a comment on one that exists (§ C).
4. Keep them in sync. Status and assignee live only in the tracker. Severity or priority is written in
   the intake file at registration; after that the tracker is authoritative and the file does not
   follow it. Reproduction steps, logs, analysis and technical detail stay in the repo: never paste
   log dumps, stack traces or full request bodies into the tracker.
5. The work is registered only once the case folder is committed; chat, memory or the tracker alone
   is not enough (engineers lose the detail). When a slug folder is renamed to the key, update the
   links that point into it.

In a pipeline run nothing is registered: a defect or requirement found outside the task is raised
for the human, who decides at the gate whether to register it.

### Plan for small work

Pipeline work gets its `plan.md` from the `implementation-planner`; quick-fix work has its own
`task.md` and `change-report.md`. Small work done by hand gets this short `plan.md`; its Verification table follows
`prove-it-works` where installed:

```markdown
# <key>: <issue title>

State: <state>
Issue: <issue URL, per the tracker skill>

## Objective
{One-sentence goal.}

## Analysis
{What you found during investigation.}

## Execution plan
1. {Step 1}

## Decisions and trade-offs
- {Decision and why.}

## Verification
| | |
|---|---|
| Artifact | {table.column, API field, or screen element that will differ} |
| Subject | {one concrete id to check} |
| Before | {value read before the change} |
| After | {value quoted after the deployed change ran} |
```

## E. Closing an issue

Before moving an issue to its final state, add a closing comment; never close silently. It contains
the branch name, a concise bullet list of the changes, the key files changed (the most important, not
all), and the final commit SHA (optional, recommended):

```markdown
Implemented on branch `<branch>`.

Changes:
- {change 1}

Key files: `path/to/file1`, `path/to/file2`
Commit: `{short SHA}`
```

Then move it to its final state. If the user asks to "close" or "mark done", add the comment first.

## F. Pipeline change history

When an agent flow runs on an issue, the tracker is the source of truth for what was agreed and how it
changed. The case folder's files stay in the repo (§ D); the tracker gets short comments in plain
language, one per event, readable by someone who never opens the repo. No file paths except full links
built as in § C, no code, no task numbers. The agents record these events without asking; the human
gates are the flows' own.

| Event (raised by) | Action |
|---|---|
| Issue created (`triage`) | Create the issue from triage's draft, only after the human's yes: a business-facing summary, with the case folder linked as in § C |
| Quick-fix started (`quick-fix`) | Move the issue to in progress. Comment: the cause (bugs) or goal, and the planned change, in plain language |
| Quick-fix done (`quick-fix`) | Closing comment (§ E) with the cause, the change, the commit, the path to `change-report.md` and what still needs checking after deploy; move the issue to review. Final state only after that check |
| Scope approved (`scoper`) | Create the issue if needed. Comment: the business rules, key decisions and open questions. Move it to the ready state |
| Agreed rule or decision changed (`scoper`, `implementation-planner`) | Comment: what changed, why, and who decided |
| Plan approved (`implementation-planner`) | Create one child item per plan task (the tracker skill's "create a child item"; follow the project's convention if it has one). Title: the task title; description: its goal in plain language. Return the keys for the manifest. Then comment on the scope issue: the decisions new in the plan, and each open question with the human's answer |
| Implementation started (`task-dispatcher`) | Move the scope issue to in progress |
| Task started / committed / failed (`task-dispatcher`) | Started: move the task's item to in progress. Committed: closing comment with branch and commit (§ E), then its final state. Failed: comment with the failure notes; leave it open |
| Implementation gate (`task-dispatcher`) | Comment: the deviations from the plan that were accepted, and each open question with its answer |
| Branch ready for review (`task-dispatcher`) | Move the scope issue to review. The closing comment (§ E) comes when it moves to its final state |

Fetch the valid states or transitions before changing one. Comments never edit the description (§ C).
