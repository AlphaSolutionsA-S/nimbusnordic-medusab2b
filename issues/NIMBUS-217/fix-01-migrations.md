# Fix 01: Generate the company and orderIngestion migrations

**Issue:** NIMBUS-217 · **Source:** deviation report, open question 2 (Klaus, 2026-10-23)

## Goal

Generate (never hand-write) the two migrations the branch is missing, and inspect their SQL.

## Environment

A throwaway Postgres container for this branch runs on `localhost:55499` (user `admin`, password
`S3cret`, database `nimbus217`). Load the variables by dot-sourcing
`C:\Users\KLAUSP~1\AppData\Local\Temp\claude\c--Users-KlausPetersen-Documents-projects-nimbusnordic-medusab2b\1fff94e7-d54d-4c22-a8f0-a7f41586e318\scratchpad\NIMBUS-217-20261023-1151\testenv.ps1`
in the same PowerShell command before each `corepack pnpm` call. Do not create or commit
`apps/backend/.env.test` (it is not gitignored). Do not use any other database or container.

## Steps

1. `corepack pnpm --filter @b2b-starter/backend exec medusa db:migrate` (bring the database to the
   develop schema), if the generator needs it.
2. `corepack pnpm --filter @b2b-starter/backend exec medusa db:generate company` and
   `... db:generate orderIngestion`.
3. Inspect the generated files:
   - company: adds `order_api_enabled boolean not null default false`; down drops it.
   - orderIngestion: drops and re-creates `shipment_tracking_close_reason_check` with
     `company_not_enabled` added; down restores the four old values.
   - No other statements. If a generated file contains unrelated drift, stop and report it rather
     than editing it.
4. Keep the updated `.snapshot-*.json` files with the migrations.
5. `medusa db:migrate` applies both cleanly.

## Done when

- Two generated migration files plus updated snapshots exist, with the SQL above.
- `db:migrate` succeeds on the container database.
- Record the SQL (up and down) in your summary. Update the Deviations of task files 01 and 04: the
  blocking deviation is resolved (append a line, do not delete the original).

## Deviations

- `medusa db:migrate` also ran the data migration scripts after the schema migrations; on this empty
  database `seed-country-languages.ts` (NIMBUS-176, not on this branch) failed with "Activate these
  languages before initializing country languages: en." The command exited 0 and every schema
  migration, including both new ones, applied. Not fixed here (out of scope).

## Done-when evidence

- Two generated migrations plus snapshots: `company/migrations/Migration20261023110444.ts`,
  `order-ingestion/migrations/Migration20261023110454.ts`, `.snapshot-company.json` (column added),
  `.snapshot-order-ingestion.json` (enum value added); SQL matches the brief, no other statements.
- `db:migrate` succeeds: log shows "Migrated Migration20261023110444" and "Migrated
  Migration20261023110454"; in the container `company.order_api_enabled` is `boolean`, not null,
  default `false`, and `shipment_tracking_close_reason_check` lists the five values.
- Task files 01 and 04: "Resolved (fix 01)" line appended to Deviations.
- Typecheck 22 (baseline 22); eslint on both migration files clean.
