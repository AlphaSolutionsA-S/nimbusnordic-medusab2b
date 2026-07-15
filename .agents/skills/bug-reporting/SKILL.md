---
name: bug-reporting
description: "Use when asked to register, file, log, or document a bug for Nimbus Nordic. Mirrors the tracker issue into issues/<caseid>/BUG.md so the tracker stays business-facing and the repo carries the engineering detail."
---

# Bug Reporting Convention — Nimbus Nordic

We split bug information across two surfaces that mirror each other 1-to-1:

| Surface | Audience | Content |
|---|---|---|
| **JIRA** *(tracker)* | Business users, PM, stakeholders | Short non-technical summary, severity, screenshots, status |
| **Repo `issues/<caseid>/`** | Engineers and agents | Reproduction steps, environment, logs, analysis, fix plan |

Always create or update **both** when a bug is reported, and link them to each other.

## When this skill applies

- The user says "register a bug", "file a bug", "log a bug", "document a bug".
- A defect surfaces during a session and we want it captured before moving on.

## Layout

```
issues/
└── <caseid>/
    ├── BUG.md          ← this skill's output
    ├── ANALYSIS.md     ← optional, created during investigation
    ├── PLAN.md         ← created when work starts (tracker workflow skill)
    ├── samples/        ← optional repro data
    └── logs/           ← optional captured logs
```

### What is `<caseid>`?

`<caseid>` is the **tracker issue key**, used verbatim as the folder name (uppercase for JIRA keys):

- JIRA: `NIMBUS-42`
- Azure DevOps: `AB-12345`
- Linear: `ENG-42`
- GitHub Issues: `42`
- **No tracker yet**: temporary id `bug-<YYYYMMDDHHmmss>-<short-slug>`, **renamed** to the real key as soon as the tracker issue is created.

One folder per case. Never two folders for the same case.

## Procedure

### Step 1 — Decide whether a tracker issue exists

1. Ask the user, or search the tracker for an existing match before creating a new one.
2. If one exists → use its key as `<caseid>`.
3. If none exists and the user wants one → defer to the installed tracker workflow skill (`jira-workflow` / `azure-devops-workflow` / `linear-workflow` / `github-issues-workflow`) to create it, then use the returned key.
4. If the user explicitly does **not** want a tracker issue → use the temporary `bug-<YYYYMMDDHHmmss>-<slug>` id and note this in BUG.md.

### Step 2 — Create `issues/<caseid>/BUG.md`

```markdown
# {Short title}

- **Tracker:** JIRA — {Issue link, or "Not yet filed"}
- **Severity:** Blocker / Critical / Major / Minor / Trivial
- **Area:** {Component / module / page}
- **Reported by:** {Name or handle}
- **Reported at:** {ISO-8601 UTC timestamp}

## Summary
{One paragraph the tracker description can quote verbatim. Plain language, no stack traces.}

## Steps to reproduce
1. …
2. …
3. …

## Expected
…

## Actual
…

## Environment
- OS:
- Browser / runtime:
- Build / commit:
- Tenant / data context:

## Evidence
- `./logs/server.log`
- `./samples/request.json`
- `./screenshot.png`

## Analysis
*(Leave empty initially. Fill in `ANALYSIS.md` when investigation starts and link from here.)*
```

### Step 3 — Mirror to the tracker

Push the **Summary** + a screenshot to the tracker issue. Do **not** dump the full BUG.md (reproduction steps and environment go into the repo, not the tracker — see the tracker workflow skill's section on attachment-safe edits).

In the tracker issue description, link back to the canonical repo location:

```
Engineering detail: https://github.com/AlphaSolutionsA-S/nimbusnordic-medusab2b/blob/develop/issues/<caseid>/BUG.md
```

### Step 4 — Keep them in sync

- Status, severity, and assignee live in the **tracker** — do not duplicate them in BUG.md (the tracker is authoritative).
- Reproduction steps, logs, and analysis live in the **repo** — never paste log dumps or stack traces into tracker comments.
- When the tracker issue moves to Done, leave `issues/<caseid>/` in place as the historical record.

## Rules

- Commit the `issues/<caseid>/` folder alongside any related fix; the fix PR should reference the same `<caseid>`.
- Never delete a case folder — completed bugs serve as historical record.
- If the case folder was created with a temporary `bug-<timestamp>-<slug>` id, **rename it** to the real tracker key the moment the tracker issue exists, and update internal links.
- Never put secrets, tokens, or customer PII in screenshots, logs, or samples. Redact first.

## Anti-patterns

- Filing the bug only in chat / memory and not committing it.
- Filing the bug only in the tracker and skipping the `issues/<caseid>/` folder (engineers lose the repro detail).
- Dumping stack traces, log files, or full request bodies into the tracker description / comments instead of the repo.
- Keeping two parallel folders (`bugs/...` and `issues/<key>/`) for the same case.
- Editing the tracker description and accidentally stripping inline screenshot attachments — add a tracker **comment** instead (see the tracker workflow skill).

## References

- The installed tracker workflow skill (`jira-workflow`, `azure-devops-workflow`, `linear-workflow`, `github-issues-workflow`) owns issue creation and status transitions.
- `feature-requests` uses the same mirror convention for new features.
