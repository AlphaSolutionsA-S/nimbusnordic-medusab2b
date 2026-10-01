---
name: jira-workflow-dev
description: "Use when starting work on a JIRA issue, switching to a new issue, being asked to 'work on NIMBUS-xxx', 'solve NIMBUS-xxx', 'fix NIMBUS-xxx', 'implement NIMBUS-xxx', or committing code; also when the user pastes a Jira URL (e.g. alphasolutionsdk.atlassian.net/browse/NIMBUS-xxx), and when closing, completing or marking an issue as done (a closing comment comes before the transition to Done). How each tracker-workflow step is done in this project's Jira."
argument-hint: "NIMBUS issue key (e.g. NIMBUS-42) or short description"
---

# Jira for Nimbus Nordic

Follow the `tracker-workflow` skill for the procedure (starting work, commits, descriptions, case
folders, closing, the pipeline change history). This skill says how each of its steps is done in Jira.

| Setting | Value |
|---|---|
| Cloud ID | `alphasolutionsdk.atlassian.net` |
| Project key | `NIMBUS` |
| Repo URL | `https://github.com/AlphaSolutionsA-S/nimbusnordic-medusab2b` |
| Default branch | `develop` |

## Keys and references

- Key and case folder: `NIMBUS-42`, folder `issues/NIMBUS-42/`.
- Commit reference: `NIMBUS-42`.
- Issue URL: `https://alphasolutionsdk.atlassian.net/browse/NIMBUS-42`.

## Operations

| tracker-workflow step | In Jira |
|---|---|
| Fetch the issue | Read `assignee` (display name and accountId, or `null`), `status`, `issuetype` (Story / Task / Bug / Sub-task / Epic) and `summary` |
| Assign | Set `assignee` to the current user's accountId (resolve it once per session) |
| Move to in progress, review, ready, final | Fetch the issue's valid transitions first, then transition; the workflow names its statuses (typically To Do, In Progress, In Review, Done) |
| Comment | Add a comment |
| Link related issues | Create an issue link (e.g. "relates to", "blocks") |
| Search | `project = NIMBUS AND text ~ "<keywords>" ORDER BY updated DESC` |
| Create an issue | The template below |
| Create a child item (per plan task) | A Sub-task of the scope issue, or a child Task when the scope issue is an Epic |

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

## Pitfalls

- Editing an issue replaces the whole `description`. If it held inline image attachments
  (screenshots pasted by a human), rewriting it strips the embeds and orphans the attachments: the
  files stay on the issue but disappear from the rendered view. Before changing an existing
  description, confirm it contains no `!image.png|...!`, `!screenshot-N.png!` or `[^attachment]`
  markup and that the user has approved replacing it; otherwise add a comment.
- Status names and allowed transitions vary per project workflow; never assume "In Progress" exists.
