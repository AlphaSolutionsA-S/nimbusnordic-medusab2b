# Fix brief: rewrap the store-access invitation paragraph

**Issue:** NIMBUS-243 (gate answer 3, Klaus Petersen, 2026-10-26)

## Problem

`docs/architecture/store-access.md`, section "Employee invitation email", line 102 runs past the
paragraph's wrap width (about 100 characters, as the surrounding lines) after task 01's rewording.

## Change

Rewrap lines 100-105 of that paragraph to the surrounding width. Wording unchanged; no other line in
the file changes.

## Test intent

None (documentation formatting only). Done when every line of the paragraph is at or under the
surrounding wrap width and `git diff` shows only re-flowed text of that paragraph.

## Deviations

- Line 100 (96 characters) was already within the width and is unchanged; lines 101-105 re-flow
  into six lines (101-106), so the paragraph grows by one line. Why: greedy fill at 100 characters
  cannot fit the long backticked path on the shorter line before it.

## Done-when evidence

- Every line of the paragraph at or under the surrounding width: re-flowed lines measure 88, 98, 70,
  99, 69 and 49 characters (surrounding lines 93-100).
- Diff is re-flow only: `git diff --word-diff=porcelain -- docs/architecture/store-access.md` shows
  no added or removed words; `git diff --stat` shows that file only, 6 insertions and 5 deletions,
  all within lines 101-106.
- Also update: none (formatting only).
