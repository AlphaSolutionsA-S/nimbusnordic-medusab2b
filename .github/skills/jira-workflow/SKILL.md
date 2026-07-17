---
name: jira-workflow
description: "Use when starting work on a JIRA issue, switching to a new issue, being asked to 'work on NIMBUS-xxx', 'solve NIMBUS-xxx', 'fix NIMBUS-xxx', 'implement NIMBUS-xxx', or committing code. Also applies when the user pastes a Jira URL (e.g. alphasolutionsdk.atlassian.net/browse/NIMBUS-xxx). Also applies when closing, completing, or marking an issue as done â€” the agent MUST add a closing comment before transitioning to Done. Single source of truth for JIRA issue lookup, assignee/status hygiene, commit-message formatting, and technical issue documentation."
argument-hint: "NIMBUS issue key (e.g. NIMBUS-42) or short description"
---

# JIRA Workflow â€” Issue Lookup, Assignment, Status & Commit Messages

This skill is the **single source of truth** for all JIRA interactions in the **Nimbus Nordic** project.

## Project Defaults

| Setting | Value |
|---|---|
| Cloud ID | `alphasolutionsdk.atlassian.net` |
| Project key | `NIMBUS` |
| Required component | `Customer Portal` |

It covers four scenarios:

1. **Starting work** â€” assignment + status hygiene (Â§ A).
2. **Committing code** â€” JIRA-referenced commit messages (Â§ B).
3. **Technical documentation** â€” repo-side issue folder for analysis, plans & data (Â§ C).
4. **Closing an issue** â€” mandatory closing comment before Done transition (§ E).

> **HARD RULE:** Never call `transitionJiraIssue` to **Done** without first calling `addCommentToJiraIssue` with a closing summary (see § E). This is the most commonly violated rule in the skill.

## When this skill applies

- The user says "let's work on NIMBUS-xxx", "start NIMBUS-xxx", "pick up NIMBUS-xxx".
- The user says "solve NIMBUS-xxx", "fix NIMBUS-xxx", "implement NIMBUS-xxx", or any action verb + issue key.
- The user pastes a Jira URL like `https://alphasolutionsdk.atlassian.net/browse/NIMBUS-xxx`.
- A new issue is identified during a session (e.g. from a commit-message lookup) and you are about to start changes.
- Switching focus from one NIMBUS issue to another.
- The user says "mark as done", "close the issue", "mark as fixed", "transition to done", or any variant that implies completing an issue â†’ follow § E.
- The agent is about to commit code (any `git commit`).

## A. Mandatory Steps When Starting Work

### A1. Fetch the issue

Call your harness' JIRA tool (e.g. `mcp_atlassian_getJiraIssue`) for the NIMBUS key and read:

- `assignee` (display name + accountId, or `null`)
- `status` (current workflow status name)
- `issuetype` (Story / Task / Bug / Sub-task / Epic)
- `summary` (sanity-check)
- `components` (must include `Customer Portal`)

if authentication fails, surface the error to the user and ask them to re-authenticate. If the issue is not found, surface that to the user and ask if they want to create a new issue.

Report assignee + status back to the user in one short line:

> `NIMBUS-42` â€” *Unassigned*, status **To Do**. Type: Task.

### A2. Self-assign if unassigned

If `assignee` is `null`:

1. Resolve the current user's accountId (cache for the session).
2. Set `assignee` to that accountId.
3. Confirm: *"Assigned NIMBUS-xxx to you."*

If already assigned to someone else â€” surface it, do **not** auto-reassign.

### A3. Ensure required component

All NIMBUS issues in this project must include component `Customer Portal`.

- If the issue already has `Customer Portal`, do nothing.
- If not, update the issue to include it (preserve any existing components).
- Confirm: *"Added component `Customer Portal` to NIMBUS-xxx."*

### A4. Suggest a status transition

Default: propose **In Progress** unless the issue is already past that. Always fetch the valid transitions before transitioning; workflow names vary.

### A5. Check Issue Progress

Before acting on a NIMBUS issue, check `issues/NIMBUS-<number>/PROGRESS.md` when it
exists. Read the latest entry, report its current handover target, and follow it unless the
user explicitly changes direction. Do not replace earlier entries.

### A6. Check SCOPE.md â€” Direct user to run the scoper agent in the foreground

- ALWAYS CHECK THIS: if no `issues/NIMBUS-<number>/SCOPE.md` exists, scoping has not been done.

> **HARD RULE â€” Never launch the scoper as a background or sub-agent task.**
>
> The scoper agent MUST run in the foreground so it can conduct its Step 1 interview interactively with the user. A background scoper cannot use `ask_user` and will substitute assumptions for real answers â€” this is the exact failure mode we are preventing.
>
> **Required action when SCOPE.md is missing:**
> 1. Tell the user that scoping is needed before implementation can begin.
> 2. Provide the following ready-to-use instruction for the user to paste into a **new chat session** (or invoke directly in a foreground agent context):
>
> ```
> @scoper Please scope NIMBUS-<number>. Jira issue: https://alphasolutionsdk.atlassian.net/browse/NIMBUS-<number>. Interview me interactively before writing any scope document.
> ```
>
> 3. **Stop here.** Do not proceed past A6 until `SCOPE.md` exists. Do not launch the scoper yourself. Do not conduct the interview yourself on behalf of the scoper.

### A7. Route to the next workflow agent

After completing A5 and A6, use the latest `PROGRESS.md` handover when it names a next agent. Otherwise, route the issue as follows.

> **HARD RULE — Jira description verification after scoping:**
> Before routing any scoped NIMBUS issue to `implementation-planner`, fetch the Jira issue description.
> - If the issue uses Jira tracking and the description is empty, scoping is **not fully complete**.
> - This means the scoper's existing-issue description update step was missed.
> - In that case, stop and repair it immediately: update the Jira description with a concise stakeholder-facing `Background`, `Goal`, and `Scope` summary before routing further.
> - Do **not** send the issue to implementation-planner while the Jira description is empty.
> **HARD RULE — Never launch implementation-planner or implementor as a background or sub-agent task.**
> Both agents have mandatory interactive gates (base branch confirmation, test infrastructure gate, plan approval) that require user input. A background run skips those gates silently, producing plans or code that bypass critical checks.
>
> For each routing case below, give the user the ready-to-use instruction and **stop**. Do not launch the agent yourself.

1. If `SCOPE.md` exists but `manifest.md` does not, tell the user the next step is implementation planning and provide this prompt:

   ```
   @implementation-planner Please plan NIMBUS-<number>. Project folder: issues/NIMBUS-<number>
   ```

2. If `manifest.md` states `**Ready for Dispatch:** true`, tell the user the next step is implementation and provide this prompt:

   ```
   @implementor Please implement NIMBUS-<number>. Project folder: issues/NIMBUS-<number>
   ```

3. If every manifest task is complete, continue with the normal closing workflow in § E.

**Stop after providing the routing prompt.** Do not proceed further until the user has run the recommended agent and returned.

### A8. Don't re-run on the same issue in the same session

Once steps A1–A7 have completed for an issue, treat it as "checked in" and skip the workflow on subsequent edits.


## B. Commit Message â€” JIRA Reference

Every commit message MUST reference a NIMBUS issue.

### B1. Format

```
NIMBUS-<number>: <concise description>
```

Examples:
- `NIMBUS-42: Remove stale section from architecture overview`
- `NIMBUS-105: Add canonical tag filtering`

### B2. Issue lookup workflow

1. **JIRA known from context** â€” use it directly.
2. **JIRA unclear** â€” search:
   ```
   project = NIMBUS AND text ~ "<keywords>" ORDER BY updated DESC
   ```
   Present the top matches; let the user pick.
3. **No match** â€” ask the user: create a new issue, or use `chore: <description>` (no JIRA reference).

### B2a. Creating a new issue (mandatory fields)

```json
{
  "cloudId": "alphasolutionsdk.atlassian.net",
  "projectKey": "NIMBUS",
  "issueTypeName": "Story",
  "summary": "...",
  "description": "...",
  "additional_fields": {
    "components": [{ "name": "Customer Portal" }]
  },
  "contentFormat": "markdown"
}
```

### B3. Commit message rules

- Never commit without confirming the JIRA reference.
- Prefer the most specific issue (Story/Task over Epic).
- Subject line â‰¤ 72 characters, imperative mood ("Add", "Fix", "Remove").

## C. Issue References (Descriptions & Comments)

### C1. Repo files â†’ full Git host URL

Never use bare workspace-relative paths in JIRA. Always link to the canonical URL on `develop` at `https://github.com/AlphaSolutionsA-S/nimbusnordic-medusab2b`.

**Pattern:**

```
https://github.com/AlphaSolutionsA-S/nimbusnordic-medusab2b/blob/develop/<repo-relative-path>
```

### C2. Cross-issue references â†’ real Jira links

Use `createIssueLink` to create proper *Linked issues* entries â€” do not dump `Related: NIMBUS-10, NIMBUS-15` in description text.

### C5. Never overwrite the description of an existing issue with attachments

`mcp_atlassian_editJiraIssue` replaces the entire `description` field. If the original description contained inline image attachments (screenshots pasted by a human), rewriting it strips those embeds and the attachments become orphaned â€” the screenshots disappear from the rendered view even though the files still exist on the issue.

Rules:

- **Do NOT call `mcp_atlassian_editJiraIssue` to change the `description`** of any existing issue unless you have first confirmed the current description contains no `!image.png|...!`, `!screenshot-N.png!`, or `[^attachment]` markup, AND the user has explicitly approved replacing it.
- To add information to an existing issue, **call `mcp_atlassian_addCommentToJiraIssue`** instead. Comments never affect the description or its embedded attachments.
- Field edits other than `description` (assignee, status via transition, labels, links, summary) are safe and do not touch attachments.
- If the user explicitly asks to rewrite a description that contains attachments, warn them that inline screenshots will be lost and require explicit confirmation before proceeding.

## D. Technical Issue Documentation â€” Repo-Side

**JIRA is for humans.** Keep JIRA descriptions/comments non-technical.

**The repo is for technical depth.** Analysis, execution plans, and data samples live in `issues/NIMBUS-{number}/` inside the solution root.

### Folder convention

```
issues/
â””â”€â”€ NIMBUS-42/
    â”œâ”€â”€ SCOPE.md
  â”œâ”€â”€ PROGRESS.md
    â”œâ”€â”€ PLAN.md
    â”œâ”€â”€ ANALYSIS.md
    â”œâ”€â”€ samples/
    â””â”€â”€ notes.md
```

Use `PROGRESS.md` for dated workflow outcomes and handovers. Create the other files as needed.

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

## E. Closing an Issue â€” Mandatory Comment Before Done

When transitioning a NIMBUS issue to **Done**, always add a closing comment **before** the transition. Never transition silently.

### E1. Closing comment content

The comment must include:

1. **Branch name** â€” e.g. `feature/NIMBUS-373-sap-search-highlight`
2. **Summary of changes** â€” concise bullet list of what was implemented
3. **Key files changed** â€” the most important files, not an exhaustive list
4. **Commit SHA** (optional but recommended) â€” the final commit hash

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
3. Never transition to Done without the comment â€” if the user asks to "close" or "mark done", add the comment first.

## Anti-patterns

- Silently starting changes without checking JIRA assignee/status.
- Reassigning an issue that belongs to another teammate without asking.
- Committing without a JIRA reference when one is available.
- Creating or editing a NIMBUS issue without component `Customer Portal`.
- **Transitioning an issue to Done without adding a closing comment first (§ E).** This is the most common violation â€” even when the user says "mark as done" or "close it", always add the comment before the transition.
- Dumping raw analysis or agent reasoning into JIRA comments instead of the repo issue folder.
- Writing bare workspace-relative paths in JIRA â€” always use the full `https://github.com/AlphaSolutionsA-S/nimbusnordic-medusab2b/blob/develop/...` URL.
- Listing related tickets as plain text instead of creating Jira issue links.


