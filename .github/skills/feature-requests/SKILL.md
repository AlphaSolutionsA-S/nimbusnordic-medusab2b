---
name: feature-requests
description: "Use when asked to register, describe, log, or document a feature request for Nimbus Nordic. Mirrors the tracker issue into issues/<caseid>/FEATURE.md so the tracker stays business-facing and the repo carries the engineering detail."
---

# Feature Request Convention â€” Nimbus Nordic

We split feature information across two surfaces that mirror each other 1-to-1:

| Surface | Audience | Content |
|---|---|---|
| **JIRA** *(tracker)* | Business users, PM, stakeholders | Short non-technical description, value, priority, status |
| **Repo `issues/<caseid>/`** | Engineers and agents | Acceptance criteria, design notes, mockups, technical plan |

Always create or update **both** when a feature is requested, and link them to each other.

## When this skill applies

- The user says "register a feature", "describe a feature", "log a feature request", "capture this requirement".
- A new requirement surfaces during a session and we want it captured before moving on.

## Layout

```
issues/
â””â”€â”€ <caseid>/
    â”œâ”€â”€ FEATURE.md      â† this skill's output
    â”œâ”€â”€ PLAN.md         â† created when work starts (tracker workflow skill)
    â”œâ”€â”€ ANALYSIS.md     â† optional design / discovery notes
    â”œâ”€â”€ mockups/        â† optional UI references
    â””â”€â”€ samples/        â† optional example payloads, data
```

### What is `<caseid>`?

`<caseid>` is the **tracker issue key**, lowercased and used verbatim as the folder name:

- JIRA: `lp-1234`
- Azure DevOps: `ab-12345`
- Linear: `eng-42`
- GitHub Issues: `42`
- **No tracker yet**: temporary id `feat-<YYYYMMDDHHmmss>-<short-slug>`, **renamed** to the real key as soon as the tracker issue is created.

One folder per case. Never two folders for the same case. Bugs and features share the same `issues/` root â€” pick the filename (`BUG.md` vs `FEATURE.md`) based on the case type.

## Procedure

### Step 1 â€” Decide whether a tracker issue exists

1. Ask the user, or search the tracker for an existing match before creating a new one.
2. If one exists â†’ use its key as `<caseid>`.
3. If none exists and the user wants one â†’ defer to the installed tracker workflow skill to create it, then use the returned key.
4. If the user explicitly does **not** want a tracker issue â†’ use the temporary `feat-<YYYYMMDDHHmmss>-<slug>` id and note this in FEATURE.md.

### Step 2 â€” Create `issues/<caseid>/FEATURE.md`

```markdown
# {Feature title}

- **Tracker:** JIRA â€” {Issue link, or "Not yet filed"}
- **Priority:** Must / Should / Could / Won't (MoSCoW)
- **Size:** XS / S / M / L / XL (T-shirt)
- **Area:** {Component / module / page}
- **Requested by:** {Name or stakeholder}
- **Requested at:** {ISO-8601 UTC timestamp}

## Description
{What the user wants. Plain language, no implementation details. Safe to quote verbatim in the tracker.}

## Why
{The user value / business reason. One paragraph.}

## Acceptance criteria
- [ ] â€¦
- [ ] â€¦
- [ ] â€¦

## Out of scope
- â€¦

## Open questions
- â€¦

## Mockups / references
- `./mockups/wireframe.png`
- Links to related work or inspiration

## Technical notes
*(Leave empty initially. Implementation plan goes in `PLAN.md` once work starts â€” do not mix it into the feature description.)*
```

### Step 3 â€” Mirror to the tracker

Push **Description**, **Why**, and **Acceptance criteria** to the tracker issue. Do **not** dump the full FEATURE.md (technical notes and mockup files belong in the repo).

In the tracker issue description, link back to the canonical repo location:

```
Engineering detail: https://github.com/AlphaSolutionsA-S/nimbusnordic-medusab2b/blob/develop/issues/<caseid>/FEATURE.md
```

### Step 4 â€” Keep them in sync

- Priority, status, and assignee live in the **tracker** â€” do not duplicate them in FEATURE.md (the tracker is authoritative).
- Acceptance criteria are the contract â€” they must match between tracker and FEATURE.md. If they drift, update both in the same commit.
- Implementation details (architecture, data model, queries, libraries) live in `PLAN.md` and never leak into the tracker description.
- When the feature ships, leave `issues/<caseid>/` in place as the historical record.

## Rules

- Commit the `issues/<caseid>/` folder; review in PR.
- If the case folder was created with a temporary `feat-<timestamp>-<slug>` id, **rename it** to the real tracker key the moment the tracker issue exists, and update internal links.
- Keep acceptance criteria outcome-focused, not implementation-focused ("user can filter by tag", not "add `tag` parameter to `/products` endpoint").

## Anti-patterns

- Mixing implementation plans into the feature description (those belong in `PLAN.md`).
- Writing acceptance criteria as implementation steps.
- Filing the feature only in chat / memory and not committing it.
- Filing the feature only in the tracker and skipping the `issues/<caseid>/` folder.
- Keeping two parallel folders (`features/...` and `issues/<key>/`) for the same case.
- Editing the tracker description and accidentally stripping inline screenshot attachments â€” add a tracker **comment** instead (see the tracker workflow skill).

## References

- The installed tracker workflow skill (`jira-workflow`, `azure-devops-workflow`, `linear-workflow`, `github-issues-workflow`) owns issue creation and status transitions.
- `bug-reporting` uses the same mirror convention for defects.

