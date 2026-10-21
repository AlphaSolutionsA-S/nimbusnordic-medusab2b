# Fix brief 01: bootstrap apply argument and journey ordering

**App:** Backend script, storefront e2e · **Found by:** first real Playwright run (gate question 1), 2026-10-21

## Defect 1: `--apply` never reaches the bootstrap script

`pnpm --filter @b2b-starter/backend exec medusa exec ./src/scripts/bootstrap-country-languages.ts --apply`
prints the `medusa exec` help and exits non-zero. The installed CLI declares `exec [file] [args..]` and
runs yargs with `.strict()` (`apps/backend/node_modules/@medusajs/cli/dist/create-cli.js` ~601 and ~700;
if missing there, the store copy under `node_modules/.pnpm/@medusajs+cli@2.21.2*`), so an unknown
`--apply` option is rejected before the script runs. Only the dry-run path was ever exercised. The
operator rollout step "apply bootstrap" is therefore impossible as documented.

Fix: make the script's apply switch an argument the CLI passes through as a positional (verify from
the installed CLI source, and by running the command, which value arrives in the script's `args`;
`apply` as a bare positional is the likely form). Keep dry-run as the default. Update every place that
documents or calls the flag: the script's header comment, `apps/storefront/e2e/visual/country-language-fixture.ts`
(`prepareFixture`), `docs/architecture/country-languages.md`, `issues/NIMBUS-176/branch-notes.md`, and
anything else a search for `--apply` finds in the branch (not frozen case folders). If the arg check
is worth a unit test (pure parse of `args`), add one; do not test by reading source text.

Verification: run the dry-run command (no writes) and show it still reports `mode: "dry-run"`. Do NOT
run the apply form yourself; the dispatcher runs it through the Playwright fixture against the local
dev database.

## Defect 2: the switcher label check depends on test order

`apps/storefront/e2e/visual/region-switcher.functional.spec.ts` "region switcher labels each published
country with its published language" reads `GET /store/country-languages` and fails with 503 when the
configuration has not yet been initialized; with `fullyParallel` it ran before the journey that
bootstraps. Make it independent of order: either have it ensure initialization through the shared
fixture helper (extract the bootstrap part of `prepareFixture` into a helper both use, with Admin
login from the same env vars), or skip it with an explicit reason when the publication is unavailable.
Prefer ensuring initialization, since the gate wants it run. Keep its existing skip when the env vars
are missing.

## Constraints

- Never touch `.vscode/mcp.json`, `apps/backend/scripts/` or the manifest. Do not commit.
- Backend typecheck baseline 22 (+3 in the untracked probe), storefront 8. Run backend lint, storefront
  lint, both typechecks, `npx playwright test --list locale-links region-switcher` (from apps/storefront)
  and any unit test you add.
- Return `### Files touched`, results, and what you verified about how the CLI passes the argument.

## Deviations

- The script now refuses any argument other than none or `apply` (usage error, before the workflow
  runs) instead of ignoring it: a mistyped switch must not look like a completed apply.
- `ensureCountryLanguagesInitialized` detects "not initialized" from the public publication (503)
  rather than the Admin route, so it needs only the publishable key and no Admin login: the bootstrap
  runs through the backend CLI, not HTTP. The region-switcher test's existing skip is unchanged.
- Added to the helper: on a failed CLI run it polls the publication for up to 60 s and fails only if it
  never turns 200, because parallel Playwright workers can bootstrap at once and the loser fails fast
  on the configuration lock (`failFastOnBusyLock` in the module service). It also extends the test
  timeout by 3 minutes while bootstrapping (the CLI boots the whole backend; default timeout is 30 s).
- Also updated (found by the `--apply` search): `apps/backend/integration-tests/http/translations/translations.spec.ts`
  (seven `runBootstrap("--apply")` calls now pass `"apply"`, which the script now requires) and
  `apps/storefront/e2e/visual/README.md` (the label test now bootstraps too).

## Done-when evidence

- `--apply` reaches the script: replaced by the bare positional `apply`. CLI source
  `@medusajs/cli/dist/create-cli.js` ~601 (`exec [file] [args..]`) and ~700 (`.strict()`); `@medusajs/medusa/dist/commands/exec.js`
  passes yargs `args` unchanged as `ExecArgs.args`. Probe script via `medusa exec`: `apply` → `["apply"]`,
  none → `[]`, `--apply` → CLI help, exit 1, script not loaded.
- Dry run stays the default: `src/scripts/__tests__/bootstrap-country-languages.unit.spec.ts`
  "is a dry run when no argument is given"; real dry run on the local dev DB logged `mode: "dry-run"`,
  nine configured countries, eight assignments, `unavailable_locales: []`, no writes.
- Apply on `apply` only, others refused: same spec, "applies only on the bare positional `apply`" and
  "rejects unexpected arguments ...". Apply path end to end: `translations.spec.ts` bootstrap cases
  (44/44 passed on a throwaway test database).
- Switcher label check independent of order: `region-switcher.functional.spec.ts` calls
  `ensureCountryLanguagesInitialized` before reading the publication; `playwright test --list` lists it.
  Running it against the backend: browser run (dispatcher).
- Also update: script header comment, `country-language-fixture.ts` (`prepareFixture` now calls the
  helper), `docs/architecture/country-languages.md` Rollout step 2, `branch-notes.md` (02 line and a
  Fix 01 section), `translations.spec.ts`, e2e `README.md`. Remaining `--apply` hits are this brief and
  frozen case-folder text only.
