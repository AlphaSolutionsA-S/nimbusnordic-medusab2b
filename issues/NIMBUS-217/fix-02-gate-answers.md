# Fix 02: Required row field and shorter registry row

**Issue:** NIMBUS-217 · **Source:** deviation report, answers 1 and 5 (Klaus, 2026-10-23)

## 1. `order_api_enabled` required on `OrderApiCompanyRow`

In `apps/backend/src/utils/order-api-access.ts`, make `order_api_enabled` required on the shared
`OrderApiCompanyRow` type (still allowing `null` if the column value can be null at runtime; the
column is `not null` after fix 01, so prefer `boolean` if the generated types now agree). Goal: a
`query.graph` call site that omits the column from its fields no longer compiles where the row is
used. Regenerate the local `.medusa` types if needed (they were stale; fix 01 / a build may refresh
them) so no cast is introduced (`NO_UNKNOWN_CAST`). Keep the rule's own behaviour (`=== true`) and
its unit tests unchanged unless the type change requires a test-input tweak.

## 2. Shorten the new `ai/architecture/decisions.md` row

Shorten only the NIMBUS-217 row ("Company enabled for the order API") until `pnpm ai:check` passes
(`corepack pnpm ai:check --fix` after editing, then `corepack pnpm ai:check`). Do not raise the limit
and do not trim any other text. Keep owner file, verdict and consumers recognisable.

## Done when

- Typecheck at or below the baseline (22), lint 0 errors, scoped unit tests pass.
- `pnpm ai:check` passes; the regenerated copies (`AGENTS.md`, `.github/copilot-instructions.md`) are
  in Files touched.

## Deviations

- Part 1, goal not reachable through the row type: Medusa types `query.graph({ entity: "companies" })`
  rows as the full generated `Company` whatever `fields` lists (a throwaway probe showed
  `Type 'Company[]'` for `fields: ["id"]`), so a call site that omits `order_api_enabled` still
  compiles. The row type is now `{ id: string; order_api_enabled: boolean }`, which matches the
  refreshed generated types (`order_api_enabled: Scalars['Boolean']['output']`) with no cast. The
  shared `ORDER_API_COMPANY_FIELDS` constant remains what keeps the column selected.
- Part 1: removed the stale comment "Local generated types can lag the company model"; the
  regenerated `.medusa/types` now carry the column. The rule's own input type
  (`order_api_enabled?: boolean | null`) is unchanged, so its unit tests are unchanged.
- Part 2, `ai:check` still fails on this Windows checkout: `core.autocrlf=true` checks `AGENTS.md`
  out with CRLF (498 extra CR bytes). The committed blob at HEAD was 32,387 bytes, already under
  32,768; the working copy was 32,885 only because of CRs. Passing on CRLF would need the row cut
  by 117 bytes, to 67 bytes or fewer, which cannot hold the owner path, verdict and consumers. The
  row is shortened from 184 to 129 bytes. The working copy is now 32,830 bytes (CRLF), 32,332 bytes
  in LF form, and `ai:check` passes when `AGENTS.md` is LF. Open for a human: normalise
  `AGENTS.md` to LF in the working tree (for example `AGENTS.md text eol=lf` in `.gitattributes`)
  or accept the check failing on CRLF checkouts. Neither was done here: config, outside the brief.

## Done-when evidence

- Typecheck at or below 22: `apps/backend/node_modules/.bin/tsc --noEmit` reports 22 errors, all
  pre-existing (`integration-tests/**` TS2769/TS2347, none in changed files).
- Lint 0 errors: `corepack pnpm --filter @b2b-starter/backend lint` exits 0 (0 errors, 13
  pre-existing warnings).
- Scoped unit tests pass: `src/utils/__tests__/order-api-access.unit.spec.ts`, 6 passed.
- `pnpm ai:check` passes: not on this CRLF checkout (32,830 > 32,768). It passes with `AGENTS.md`
  in LF form, the form git commits (see Deviations). The regenerated `AGENTS.md` and
  `.github/copilot-instructions.md` are in Files touched.
- Also update: the branch notes (task 03 line on stale `.medusa` types and the task 04 row-type
  line) are superseded by a Fix 02 section. No other test or doc asserts the row type.
