---
name: feature-requests
description: "Use when asked to register, describe, log, or document a feature request for Nimbus Nordic. Mirrors the tracker issue into issues/<key>/feature.md so the tracker stays business-facing and the repo carries the engineering detail."
---

# Feature requests — Nimbus Nordic

Register a feature request, including a new requirement that surfaces during a session ("capture this
requirement"), with the intake mirror in `tracker-workflow` § D, the procedure it shares with
`bug-reporting`. This skill holds the feature template and what differs for features.

| Surface | Content |
|---|---|
| Jira (NIMBUS) (tracker) | Short non-technical description, value, priority, status |
| Repo `issues/<key>/feature.md` | Acceptance criteria, design notes, mockups, technical plan |

## Template: `issues/<key>/feature.md`

```markdown
# {Feature title}

- Tracker: Jira (NIMBUS) — {Issue link, or "Not yet filed"}
- Priority: Must / Should / Could / Won't (MoSCoW)
- Size: XS / S / M / L / XL (T-shirt)
- Area: {Component / module / page}
- Requested by: {Name or stakeholder}
- Requested at: {ISO-8601 UTC timestamp}

## Description
{What the user wants. Plain language, no implementation details. Safe to quote verbatim in the tracker.}

## Why
{The user value / business reason. One paragraph.}

## Acceptance criteria
- [ ] …

## Out of scope
- …

## Open questions
- …

## Mockups / references
- `./mockups/wireframe.png`
- Links to related work or inspiration

## Technical notes
*(Leave empty initially. The implementation plan goes in `plan.md` once work starts; don't mix it into the feature description.)*
```

Keep acceptance criteria outcome-focused, not implementation steps: "user can filter by tag", not "add `tag` parameter to `/products` endpoint".

## Mirrored to the tracker

Description, Why and Acceptance criteria. Technical notes and mockup files stay in the repo.

## Specific to features

- Acceptance criteria are the contract and match between tracker and `feature.md`. If they drift, update both in the same commit.
- Implementation details (architecture, data model, queries, libraries) live in `plan.md` and never leak into the tracker description or the feature description.
- A feature is registered only once its case folder is committed and reviewed in a PR.
