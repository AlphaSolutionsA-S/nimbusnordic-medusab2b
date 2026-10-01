---
name: bug-reporting
description: "Use when asked to register, file, log, or document a bug for Nimbus Nordic. Mirrors the tracker issue into issues/<key>/bug.md so the tracker stays business-facing and the repo carries the engineering detail."
---

# Bug reporting — Nimbus Nordic

Register a bug with the intake mirror in `tracker-workflow` § D, the procedure it shares with
`feature-requests`. This skill holds the bug template and what differs for bugs.

| Surface | Content |
|---|---|
| Jira (NIMBUS) (tracker) | Short non-technical summary, severity, screenshots, status |
| Repo `issues/<key>/bug.md` | Reproduction steps, environment, logs, analysis, fix plan |

## Template: `issues/<key>/bug.md`

```markdown
# {Short title}

- Tracker: Jira (NIMBUS) — {Issue link, or "Not yet filed"}
- Severity: Blocker / Critical / Major / Minor / Trivial
- Area: {Component / module / page}
- Reported by: {Name or handle}
- Reported at: {ISO-8601 UTC timestamp}

## Summary
{One paragraph the tracker description can quote verbatim. Plain language, no stack traces.}

## Steps to reproduce
1. …

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
*(Leave empty initially. Fill in `analysis.md` when investigation starts and link from here.)*
```

## Mirrored to the tracker

The Summary and a screenshot. Reproduction steps, environment and logs stay in the repo.

## Specific to bugs

- Commit the case folder with the related fix; the fix PR references the same key.
