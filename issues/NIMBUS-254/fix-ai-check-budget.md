# Fix brief: bring generated AGENTS.md back under the 32 KiB budget

**Issue:** NIMBUS-254 · **From:** gate answer 1 (`deviation-report.md`, Open questions), option (b)

## Problem

`pnpm ai:check` fails: the generated root `AGENTS.md` is 32930 bytes, 162 over
`limits.agents_md_bytes` (32768, `ai/harness.json`). Codex stops reading past 32 KiB by default, so
the limit stays.

## Change

- Trim at least 162 bytes of Tier 0 text, plus sensible headroom (aim for 500 bytes or more under
  the limit), in `ai/architecture/*.md` and/or `ai/AGENTS.md`.
- Tighten wording only. Do not drop any rule, rule ID, table row, path, status or meaning. Do not
  change what any rule requires.
- Keep the new `decisions.md` row ("BC company sync ...") exactly as it is.
- Do not touch `ai/harness.json` or its limit.
- Then `pnpm ai:check --fix` (regenerates root `AGENTS.md`, `.github/copilot-instructions.md`, etc.)
  and `pnpm ai:check` until it passes. `pnpm` may need `corepack pnpm`.

## Done when

- `pnpm ai:check` passes; report the new `AGENTS.md` byte count.
- A list of each edit (file, before → after) so the reviewer can confirm no meaning was lost.
- No source code changed.
