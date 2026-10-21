# NIMBUS-176: Run the country-language bootstrap as a data migration script

Quick fix (change mode) on the NIMBUS-176 branch, confirmed by Klaus Petersen on 2026-10-21.

## Summary

The rollout needed `medusa exec ./src/scripts/bootstrap-country-languages.ts apply` per environment,
but Medusa Cloud cannot run `medusa exec`. The bootstrap now also runs as a Medusa data migration
script, `apps/backend/src/migration-scripts/seed-country-languages.ts`, which Medusa runs once per
environment during `medusa db:migrate` on deploy. A country whose legacy language is missing or
inactive is skipped (it uses English) and logged, instead of failing the deploy. The `medusa exec`
script stays for local dry runs and a strict apply.

## Flows

1. Backend deploy runs `medusa db:migrate`: module migrations, then migration scripts in file-name
   order; `seed-country-languages.ts` sorts after `initial-data-seed.ts`, so a fresh database has its
   regions first.
2. The script runs `bootstrapCountryLanguagesWorkflow` with the shared legacy map, `apply: true` and
   `skip_unavailable_languages: true`.
3. The workflow proposes assignments for the configured countries, reads the unavailable languages,
   drops the countries on those languages (`skipped`), and inserts the configuration only if none
   exists, then reads the publication back.
4. The script logs "created" or "already initialized, existing configuration kept", and when it
   created the configuration, the skipped `country→locale` pairs (warn).
5. Success: Medusa records the script in `script_migrations` and never runs it again. Failure (English
   unavailable, lock busy): it throws, Medusa logs and rethrows, and the script runs again on the next
   `db:migrate`.

## What was built

| Part | Layer | Rule |
|---|---|---|
| `skipUnavailableAssignments` in `workflows/storefront-translation/utils/country-language-scope.ts` | L5 | A country whose language is unavailable is left out and reported; nothing is dropped for an empty list |
| `LEGACY_COUNTRY_LANGUAGES` in `workflows/storefront-translation/utils/legacy-country-languages.ts` | L5 (data) | One backend home for the legacy map, shared by both scripts |
| `bootstrapCountryLanguagesWorkflow`: optional input `skip_unavailable_languages`, output `skipped` | L4 | Skip only when asked; the service still requires English and every assigned language, under its lock, and never overwrites |
| `migration-scripts/seed-country-languages.ts` | deploy trigger (calls one workflow) | Apply with skip; log the outcome without personal data |
| `scripts/bootstrap-country-languages.ts` | operator script | Unchanged behaviour; imports the shared map |

## Business rules

- Configuration absent, legacy language missing or inactive → deploy bootstrap → configuration created
  without those countries; they publish as `default` (English); the pairs are logged.
- Configuration absent, English unavailable → deploy bootstrap → script fails, nothing written, reruns
  on the next deploy.
- Configuration present → deploy bootstrap → unchanged (Admin edits kept).
- Operator `apply` (exec script) → still refuses while any legacy language is unavailable.

## Decisions

- File name `seed-country-languages.ts`, not `bootstrap-country-languages.ts`: Medusa orders scripts by
  file name, and it must follow `initial-data-seed.ts` on a fresh database.
- English unavailable still fails: there is no default to fall back to, and a script that returned
  normally would be recorded and never rerun, leaving the environment uninitialized.
- Skip is opt-in per call, so the operator `apply` keeps the strict behaviour.
- The workflow always applies the pure function (with an empty list when the flag is off) rather than
  branching; its `assignments` output stays the proposed set, the difference is `skipped`.
- The skipped pairs are logged only when the script created the configuration.

## Tests

- Unit `workflows/storefront-translation/utils/__tests__/country-language-scope.unit.spec.ts`:
  skips exactly the unavailable countries and reports them; keeps everything when none is unavailable;
  never drops a country on an available language.
- HTTP `integration-tests/http/translations/translations.spec.ts` › deploy migration script (real
  Postgres, real container, no mocks): an inactive `sv` skips `se` (publishes as default), logs
  `se→sv`, and a rerun after an Admin save keeps the edited configuration; with English unavailable it
  rejects and writes nothing. Exec-script summaries gained `skipped: {}`; strict apply still rejects.
- Results: unit 13/13 (with the exec-script spec), HTTP translations 46/46, backend lint 0 errors,
  backend tsc 22 errors = baseline (all in `integration-tests/`).
- Local `medusa db:migrate --skip-links` (local dev database `localhost:5432/nimbus-medusa-dev` only;
  without `--skip-links` the link sync stops at an interactive prompt about a core link,
  `product_variant_inventory_item`, which predates this change and was not acted on): exit 0; the log
  shows "Running migration script …/seed-country-languages.ts", "Country-language bootstrap: already
  initialized, existing configuration kept." and "completed (0.23s)". Read back: `script_migrations`
  has `seed-country-languages.ts` with `finished_at` 2026-10-21T11:41:16Z; the configuration is
  unchanged (version 9, same assignments).

## Also updated

- `docs/architecture/country-languages.md`: Components, Rules and Rollout (deploy runs the bootstrap;
  read back; storefront; local-only dry run; Cloud-deploy blocking on a failed script UNVERIFIED).
- `ai/architecture/decisions.md`: row for the skip rule; `AGENTS.md` and
  `.github/copilot-instructions.md` regenerated by `pnpm ai:check --fix` (its size failure is the
  known Q8).
- PR description (dispatcher scratchpad): Release steps, Operator/Deploy bootstrap bullets, decisions.
- Unchanged and still valid: `apps/storefront/e2e/visual/country-language-fixture.ts` and its README
  (they run the exec script locally).

## Verify after deploy

Per environment, after the backend deploy: the deploy log shows "Country-language bootstrap: created"
(and any skipped pairs), `script_migrations` has `seed-country-languages.ts` with `finished_at`, and
`GET /admin/country-languages` and `GET /store/country-languages` return 200 with the expected
languages. Before value: no Cloud environment has the configuration yet (never deployed).

## Open questions and follow-ups

- Whether a migration script that throws blocks a Medusa Cloud deploy is unverified (Medusa docs say
  it reruns on the next deploy).
- On a fresh database the script fails until English is imported and activated (then rerun
  `db:migrate`); acceptable for existing environments, noted for new ones.
