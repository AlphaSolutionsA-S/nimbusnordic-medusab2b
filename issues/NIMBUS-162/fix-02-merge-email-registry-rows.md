# Fix brief 02: merge the two email registry rows so `ai:check` passes

**Issue:** NIMBUS-162 (rows added by NIMBUS-244 and NIMBUS-245). Gate answer 1 (Klaus Petersen,
2026-10-25), recorded in `deviation-report.md`.

## Problem

`pnpm ai:check` fails: the generated root `AGENTS.md` is 33103 bytes, over the 32768-byte limit,
after tasks 01 and 02 each added a row to `ai/architecture/decisions.md` ("Email language and link
country" and "Email text fallback: language, English, built-in").

## Change

- In `ai/architecture/decisions.md`, merge those two rows into one row and trim its wording until the
  generated `AGENTS.md` is under 32768 bytes. Keep both owning files named
  (`B/workflows/transactional-email/utils/email-language.ts`, `email-texts.ts`), the fact that the
  built-in English copies are an approved fallback copy of the English `Emails` texts, and the
  consumers (reset and invitation emails). Keep it a correct registry row (rule, owning file, verdict,
  consumers, status).
- Do not change the meaning of any other row, and do not edit any other Tier 0 file.
- Run `pnpm ai:check --fix` (regenerates `AGENTS.md`, `.github/copilot-instructions.md`), then
  `pnpm ai:check`, which must pass. Report the final byte size.

## Done when

`pnpm ai:check` exits 0; the diff touches only the two email rows plus the generated files.
Use `corepack pnpm` (pnpm is not on PATH).

## Deviations

- Blocking: the brief cannot be met within its limits. On `develop` the generated `AGENTS.md` is
  already 32751 bytes (17 bytes of headroom); the two email rows added 352 bytes (158 + 192 + line
  ends). A merged row would have to be at most about 16 bytes, so no merge that keeps the owning
  files, verdict, consumers and fallback status can pass while the diff stays limited to the email
  rows. The merge was applied anyway (gate answer 1), bringing `AGENTS.md` from 33103 to 32976 bytes,
  still 208 bytes over. Getting under 32768 needs a decision outside this brief: trim wording in
  other Tier 0 rows or files, move content out of `ai/AGENTS.md`, or drop the row.
- Merged row wording: "Email language, link country, text fallback" (dropped the "(NIMBUS-162)"
  tag to save bytes; the commit history carries the key); consumers shortened to "reset, invitation
  emails" (the email builders are the reset and invitation emails).

- Follow-up (dispatcher, 2026-10-25): wording-only trims in other `decisions.md` rows were allowed,
  provided they keep each row's meaning. Applied (103 bytes saved), before → after:
  - Header: "Verdict exposed via" → "Verdict via".
  - Separator: `|------|-------------|---------------------|-----------|--------|` → `|---|---|---|---|---|`.
  - Password recovery, owning file: "`…/send-password-reset.ts` (email)" → "`…/send-password-reset.ts`"
    (the verdict column already says Notification `email`).
  - "BC-managed company fields are read-only" → "BC-managed company fields read-only".
  - "Sent or recorded BC orders require duplicate protection and a force warning" → "Sent or
    recorded BC orders need duplicate protection, force warning".
  - "BC submission skips existing orders unless force is explicit" → "… unless explicitly forced".
  - "Store order read and return: owner, …" → "Order read and return: owner, …" (consumers name
    the store routes).
  - "skips countries whose legacy language is unavailable (English default)" → "skips countries
    with an unavailable legacy language (English default)".
  - Country language consumers: "Admin Translations page;" → "Admin Translations;".
  - Country language status: "…: approved cold-outage fallback, not a second rule" → "…: approved
    cold-outage fallback".
- Still blocking after those trims: `AGENTS.md` is 32873 bytes, 105 over. No further trim without
  losing information was found (the remaining length is paths, issue keys, function names and
  listed consumers). Options for Klaus: drop the cell padding spaces in every table row (pure
  formatting, about 200 bytes); write `/{admin,store}/country-languages` (22 bytes); or move
  content elsewhere in `ai/AGENTS.md` or another Tier 0 file.
- Second follow-up (dispatcher, 2026-10-25): option 1 applied. The spaces around every `|` in the
  registry table (header, separator and all rule rows) were removed; no cell text changed (checked
  by comparing each row's trimmed cells before and after). Every table row still has 6 pipes
  (5 columns). `AGENTS.md` is now 32663 bytes.

## Done-when evidence

- `pnpm ai:check` exits 0: met. `corepack pnpm ai:check` passed (harness 2.1.2), exit 0;
  `AGENTS.md` 32663 bytes (33103 before the fix, 32976 after the merge, 32873 after the trims).
- Diff limited to the registry: met, widened by the follow-ups. In `decisions.md`, `AGENTS.md` and
  `.github/copilot-instructions.md`, every changed line is a registry table row (`git diff -U0`
  filtered for lines not starting with `|`: 0 in each file). The two email rows became one; the
  other rows changed only by the trims and padding listed in Deviations.
- Also update: none found beyond the generated files (`ai:check --fix` rewrote both).

## Acceptance

Accepted as it is by Klaus Petersen on 2026-10-26: the merged email row, the wording trims in other
rows and the removed padding around `|`. The `AGENTS.md` size limit itself is being registered as a
separate issue.
