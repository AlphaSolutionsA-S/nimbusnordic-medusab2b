# Make room in the always-loaded AI architecture rules

- Tracker: Jira (NIMBUS) — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-251
- Priority: Should
- Size: S
- Area: AI base (`ai/AGENTS.md`, `ai/architecture/`)
- Requested by: Klaus Petersen
- Requested at: 2026-10-26

## Description
The development team's AI tooling loads a fixed set of architecture rules in every session, and that
set has a size limit. It is now nearly full: when NIMBUS-162 added a business rule, other rules had
to be reworded and the rules table reformatted to fit. The next rule anyone adds will hit the limit
again.

## Why
The rules keep the AI-assisted work consistent and safe. Without room, new business rules cannot be
registered, or other rules get trimmed until they lose meaning.

## Acceptance criteria
- [ ] A new business rule can be added without rewording or removing other rules.
- [ ] The AI rules check passes with clear headroom (at least a few kilobytes).
- [ ] No rule loses meaning; content that moves out of the always-loaded set stays reachable where
      agents read it.

## Out of scope
- Changing what any rule says.

## Open questions
- Which content moves out of the always-loaded block (for example the business-rule registry, which
  agents could load on demand), and whether the harness limit itself should change (Alpha Solutions
  harness, `ai/harness.json`).

## Mockups / references
- NIMBUS-162 fix 02 (`issues/NIMBUS-162/`, until cleanup): `develop` had 17 bytes of headroom; the
  generated root `AGENTS.md` limit is 32768 bytes, checked by `pnpm ai:check`.

## Technical notes
