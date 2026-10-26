# Fix brief: Tier 0 headroom under the AGENTS.md size limit (gate answer 1)

**Key:** NIMBUS-255 · **App:** `ai/` (no app code) · **Status:** DONE

## Goal

`pnpm ai:check` fails: after merging `develop` (d210389, which already includes NIMBUS-254's trim
98cf6f7 and its own new `decisions.md` row), the generated root `AGENTS.md` is 32803 bytes, over
the 32768-byte limit, with this branch's new `ai/architecture/decisions.md` row. The human chose to
keep the row and trim thoroughly, because this limit keeps being hit: free at least 1.5 KB of
headroom, aiming for about 2 KB (`AGENTS.md` at or below about 30,800 bytes).

## Change

- Work on top of develop's wording as now on the branch. Tighten the files in
  `ai/architecture/*.md` (inlined into the generated `AGENTS.md`): shorter phrasing, removed
  repetition between files (e.g. a statement in both `boundaries.md` and `medusa-boundary.md`, or in
  `rules.md` and the file it indexes), compressed long `decisions.md` rows (e.g. the shipment-notice
  row: keep the rule's name and owning path; detail that belongs in the owning utils can go). If
  that is not enough, `ai/AGENTS.md` may be tightened the same way.
- Never drop a rule, a rule ID, a path, a verdict, a baseline entry, a status or an owning file.
  Every ID present at HEAD must still be present with the same meaning. Keep both new
  `decisions.md` rows (NIMBUS-255 and NIMBUS-254).
- Do not edit catalog-owned `ai/instructions/*`.
- Edit content only in `ai/` (per `ai/CONTRIBUTING.md`), then `pnpm ai:check --fix` to regenerate
  the pointer files, then `pnpm ai:check`.
- An earlier attempt on the pre-merge base is saved as a reference patch (not to be applied
  blindly; develop's wording differs): `<run scratchpad>/fix02-trim-on-old-base.patch`, with its
  notes in `<run scratchpad>/fix02-brief-after-first-run.md` (it reached 31000 bytes from 32891 by
  removing table cell padding, merging repeated statements, compressing the shipment-notice and
  country-language rows, and folding the `boundaries.md` Verdict column into the header).

## Test intent

No code tests. Evidence instead:
- `pnpm ai:check` passes.
- Byte size of `AGENTS.md` before (32803) and after, and the headroom under 32768.
- Every backticked token (rule IDs and paths) in `ai/architecture/*.md` and `ai/AGENTS.md` at HEAD
  is still present after the edit (the earlier run's script `<run scratchpad>/tier0-tokens.mjs`
  can be reused); list any token that moves between files. Write before/after lists to the run
  scratchpad.

## Done when

- `pnpm ai:check` passes with at least 1.5 KB headroom; the ID and path check shows no loss.
- Record the before/after sizes in `issues/NIMBUS-255/branch-notes.md`.

## Deviations

- Headroom is 1543 bytes (`AGENTS.md` 31225), above the 1.5 KB (1536-byte) floor but about 400
  bytes short of the ~30,800 aim. Develop's trim (98cf6f7) had already taken the easy wording
  savings; going further in Tier 0 or `ai/AGENTS.md` would cut content, not wording. The rest of
  the file is the catalog-owned always-on block (`ai/instructions/agent-discipline.md`,
  `commit-messages.md`), out of scope here. Option for the human: the "Reporting results" bullet
  in `agent-discipline.md` (~330 bytes) points at `prove-it-works`, which `ai/harness.json` lists
  as declined.
- Detail removed (allowed by the brief; rule, owning path, verdict and status stay): the
  shipment-notice row loses "(R1, R2, R4)", "missing row fails the check" and the undo pairing
  keys (they live in `B/workflows/shipment-notice/utils/`); the country-language assignment row
  loses its consumer list "(request config, layouts, metadata, switcher, text refresh)" and "not a
  second rule"; the locales row's "(admin consumer)" became "(admin)".
- Repetition merged: the separate "wrong `query.graph` path" bullet folded into
  `data-schema-vs-model`; the "Pitfalls" section became a bullet under "Reading core data" (no
  reference to that heading exists); the raw-SQL bullet folded into the owner-only bullet in
  `data-ownership.md`; "baseline, not a retrofit" moved from `boundaries.md` into the `rules.md`
  intro; `decisions.md` refers to `boundaries.md` for `B`/`S`; "Test volume is a signal" joined the first bullet.
- `boundaries.md` table: the Verdict column folded into the header ("To (forbidden unless
  noted)"); the two other verdicts ("only ... allowed", "required") stay in their rows.
- Table cell padding removed in Tier 0 and in the `ai/AGENTS.md` context tables (`| a |` to
  `|a|`); the Agents table (not in the generated file) keeps its padding. Headings referenced
  elsewhere (Types, Workflow failures, Module-service constraints, Verify, don't assume, OOTB
  first, Whole-branch checks) kept.
- Also edited `ai/AGENTS.md` prose (Commands, Tools, Starting work, Pipeline runs, Case folders),
  as the brief allows.
- Review rework: restored "2.21.0" and "before use" in `medusa-boundary.md`, "never delete it
  to pass" and the whole-branch UI-text check ("translation key (`react/jsx-no-literals`)") in
  `verification.md`; the bytes were recovered by wording only (`medusa-boundary.md` verify
  bullet, locales row, two phrases in `ai/AGENTS.md` Case folders and Pipeline runs).

## Done-when evidence

- `pnpm ai:check` passes: "ai:check passed (harness 2.1.2): 20 skills, 12 agents, 4 instructions,
  7 Tier 0 files (263 lines); stubs, tables and generated blocks in sync."
- Size: `AGENTS.md` 32803 bytes at HEAD d210389, 31225 now; headroom 1543 bytes under 32768 (was
  -35). `.github/copilot-instructions.md` 30832 to 29708.
- Loss check: run-scratchpad `tier0-tokens.mjs` (`tokens-before.txt`, `tokens-after.txt`,
  `tokens-diff.txt`): 405 backticked tokens at HEAD, 405 now; 40 rule IDs at HEAD, 40 now; lost
  globally: none. Per-file moves: `apps/backend/src`, `apps/storefront/src` leave `decisions.md`
  (defined in `boundaries.md`); no other move.
  Both new `decisions.md` rows (NIMBUS-255 BC order line display, NIMBUS-254 BC company sync) kept
  verbatim.
- Sizes recorded in `issues/NIMBUS-255/branch-notes.md` (fix-02).
