---
name: jira-workflow
description: "Use when starting work on a JIRA issue, switching to a new issue, being asked to 'work on NIMBUS-xxx', 'solve NIMBUS-xxx', 'fix NIMBUS-xxx', 'implement NIMBUS-xxx', or committing code. Also applies when the user pastes a Jira URL (e.g. alphasolutionsdk.atlassian.net/browse/NIMBUS-xxx). Also applies when closing, completing, or marking an issue as done — the agent MUST add a closing comment before transitioning to Done. Single source of truth for JIRA issue lookup, assignee/status hygiene, commit-message formatting, and technical issue documentation."
argument-hint: "NIMBUS issue key (e.g. NIMBUS-42) or short description"
---

# JIRA Workflow — Issue Lookup, Assignment, Status & Commit Messages

This skill is the **single source of truth** for all JIRA interactions in the **Nimbus Nordic** project.

## Project Defaults

| Setting | Value |
|---|---|
| Cloud ID | `alphasolutionsdk.atlassian.net` |
| Project key | `NIMBUS` |

It covers four scenarios:

1. **Starting work** — assignment + status hygiene (§ A).
2. **Committing code** — JIRA-referenced commit messages (§ B).
3. **Technical documentation** — repo-side issue folder for analysis, plans & data (§ C).
4. **Closing an issue** — mandatory closing comment before Done transition (§ E).

> **HARD RULE:** Never call `transitionJiraIssue` to **Done** without first calling `addCommentToJiraIssue` with a closing summary (see § E). This is the most commonly violated rule in the skill.

## When this skill applies

- The user says "let's work on NIMBUS-xxx", "start NIMBUS-xxx", "pick up NIMBUS-xxx".
- The user says "solve NIMBUS-xxx", "fix NIMBUS-xxx", "implement NIMBUS-xxx", or any action verb + issue key.
- The user pastes a Jira URL like `https://alphasolutionsdk.atlassian.net/browse/NIMBUS-xxx`.
- A new issue is identified during a session (e.g. from a commit-message lookup) and you are about to start changes.
- Switching focus from one NIMBUS issue to another.
- The user says "mark as done", "close the issue", "mark as fixed", "transition to done", or any variant that implies completing an issue → follow § E.
- The agent is about to commit code (any `git commit`).

## A. Mandatory Steps When Starting Work

### A1. Fetch the issue

Call your harness' JIRA tool (e.g. `mcp_atlassian_getJiraIssue`) for the NIMBUS key and read:

- `assignee` (display name + accountId, or `null`)
- `status` (current workflow status name)
- `issuetype` (Story / Task / Bug / Sub-task / Epic)
- `summary` (sanity-check)

Report assignee + status back to the user in one short line:

> `NIMBUS-42` — *Unassigned*, status **To Do**. Type: Task.

### A2. Self-assign if unassigned

If `assignee` is `null`:

1. Resolve the current user's accountId (cache for the session).
2. Set `assignee` to that accountId.
3. Confirm: *"Assigned NIMBUS-xxx to you."*

If already assigned to someone else — surface it, do **not** auto-reassign.

### A3. Suggest a status transition

Default: propose **In Progress** unless the issue is already past that. Always fetch the valid transitions before transitioning; workflow names vary.

### A4. Don't re-run on the same issue in the same session

Once steps 1–3 have completed for an issue, treat it as "checked in" and skip the workflow on subsequent edits.

## B. Commit Message — JIRA Reference

Every commit message MUST reference a NIMBUS issue.

### B1. Format

```
NIMBUS-<number>: <concise description>
```

Examples:
- `NIMBUS-42: Remove stale section from architecture overview`
- `NIMBUS-105: Add canonical tag filtering`

### B2. Issue lookup workflow

1. **JIRA known from context** — use it directly.
2. **JIRA unclear** — search:
   ```
   project = NIMBUS AND text ~ "<keywords>" ORDER BY updated DESC
   ```
   Present the top matches; let the user pick.
3. **No match** — ask the user: create a new issue, or use `chore: <description>` (no JIRA reference).

### B2a. Creating a new issue (mandatory fields)

```json
{
  "cloudId": "alphasolutionsdk.atlassian.net",
  "projectKey": "NIMBUS",
  "issueTypeName": "Story",
  "summary": "...",
  "description": "...",
  "contentFormat": "markdown"
}
```

### B3. Commit message rules

- Never commit without confirming the JIRA reference.
- Prefer the most specific issue (Story/Task over Epic).
- Subject line ≤ 72 characters, imperative mood ("Add", "Fix", "Remove").

## C. Issue References (Descriptions & Comments)

### C1. Repo files → full Git host URL

Never use bare workspace-relative paths in JIRA. Always link to the canonical URL on `develop` at `https://github.com/AlphaSolutionsA-S/nimbusnordic-medusab2b`.

**Pattern:**

```
https://github.com/AlphaSolutionsA-S/nimbusnordic-medusab2b/blob/develop/<repo-relative-path>
```

### C2. Cross-issue references → real Jira links

Use `createIssueLink` to create proper *Linked issues* entries — do not dump `Related: NIMBUS-10, NIMBUS-15` in description text.

### C5. Never overwrite the description of an existing issue with attachments

`mcp_atlassian_editJiraIssue` replaces the entire `description` field. If the original description contained inline image attachments (screenshots pasted by a human), rewriting it strips those embeds and the attachments become orphaned — the screenshots disappear from the rendered view even though the files still exist on the issue.

Rules:

- **Do NOT call `mcp_atlassian_editJiraIssue` to change the `description`** of any existing issue unless you have first confirmed the current description contains no `!image.png|...!`, `!screenshot-N.png!`, or `[^attachment]` markup, AND the user has explicitly approved replacing it.
- To add information to an existing issue, **call `mcp_atlassian_addCommentToJiraIssue`** instead. Comments never affect the description or its embedded attachments.
- Field edits other than `description` (assignee, status via transition, labels, links, summary) are safe and do not touch attachments.
- If the user explicitly asks to rewrite a description that contains attachments, warn them that inline screenshots will be lost and require explicit confirmation before proceeding.

## D. Technical Issue Documentation — Repo-Side

**JIRA is for humans.** Keep JIRA descriptions/comments non-technical.

**The repo is for technical depth.** Analysis, execution plans, and data samples live in `issues/NIMBUS-{number}/` inside the solution root.

### Folder convention

```
issues/
└── NIMBUS-42/
    ├── PLAN.md
    ├── ANALYSIS.md
    ├── samples/
    └── notes.md
```

Only `PLAN.md` is expected for every issue. Create the rest as needed.

### PLAN.md template

```markdown
# NIMBUS-{number}: {JIRA summary}

**Status:** In Progress
**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-{number}

## Objective
{One-sentence goal.}

## Analysis
{What you found during investigation.}

## Execution Plan
1. {Step 1}
2. {Step 2}

## Decisions & Trade-offs
- {Decision and why.}

## Verification
- [ ] {How to verify.}
```

## E. Closing an Issue — Mandatory Comment Before Done

When transitioning a NIMBUS issue to **Done**, always add a closing comment **before** the transition. Never transition silently.

### E1. Closing comment content

The comment must include:

1. **Branch name** — e.g. `feature/NIMBUS-373-sap-search-highlight`
2. **Summary of changes** — concise bullet list of what was implemented
3. **Key files changed** — the most important files, not an exhaustive list
4. **Commit SHA** (optional but recommended) — the final commit hash

### E2. Template

```markdown
Implemented on branch `feature/NIMBUS-{id}-{slug}`.

**Changes:**
- {change 1}
- {change 2}

Key files: `path/to/file1`, `path/to/file2`
Commit: `{short SHA}`
```

### E3. Procedure

1. **Add comment** via `addCommentToJiraIssue` with the closing summary.
2. **Then transition** to Done via `transitionJiraIssue`.
3. Never transition to Done without the comment — if the user asks to "close" or "mark done", add the comment first.

## Anti-patterns

- Silently starting changes without checking JIRA assignee/status.
- Reassigning an issue that belongs to another teammate without asking.
- Committing without a JIRA reference when one is available.
- **Transitioning an issue to Done without adding a closing comment first (§ E).** This is the most common violation — even when the user says "mark as done" or "close it", always add the comment before the transition.
- Dumping raw analysis or agent reasoning into JIRA comments instead of the repo issue folder.
- Writing bare workspace-relative paths in JIRA — always use the full `https://github.com/AlphaSolutionsA-S/nimbusnordic-medusab2b/blob/develop/...` URL.
- Listing related tickets as plain text instead of creating Jira issue links.
