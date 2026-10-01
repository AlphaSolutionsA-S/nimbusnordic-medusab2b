# Verification

What a test must prove and at which layer. Commands are in `ai/AGENTS.md` (Commands).

| Layer | Tool and location | Use for |
|---|---|---|
| Unit | Jest: backend `src/**/__tests__/*.unit.spec.ts`, admin `src/admin/**/__tests__/*.test.tsx`, storefront `src/__tests__/**` (mirrors `app/`, `lib/`, `modules/`). Vitest: CMS `src/**/*.test.ts` | pure decision functions on plain data |
| Contract | Jest: `apps/backend/integration-tests/http/<area>/*.spec.ts`, real Postgres | endpoint contracts |
| Integration | Jest: `apps/backend/src/modules/<m>/__tests__/*.spec.ts`; Playwright: `apps/storefront/e2e/visual/` | what a contract test can't see: lock order, partial failure, races |

- Test behaviour: business rules, error and edge handling, security boundaries, mechanisms that fail
  silently (event vs direct call, lock order, diff vs delete-and-recreate). Skip pass-through mapping,
  framework guarantees and trivial rendering.
- Assert at the depth the caller consumes: the type of each field it uses, not that its container
  exists.
- Security work carries negative cases per property (membership, role, cross-company access) in
  `integration-tests/http/security/security-boundaries.spec.ts`; a property that depends on vendor
  behaviour is tested once against the real library.
- Never mock framework-resolved services to assert their call order; test the extracted pure decision
  or move the case to integration. Keep dependency resolution and I/O where the framework puts them
  and extract only pure logic, never a `*Logic(input, deps)` mocking seam.
- Never read source files as text in a test; prefer a behaviour assertion, then importing the module
  and asserting on its exports, then a lint rule for absence claims. Reading a fixture is fine.
- Per task: only the tests created or changed, lint and whole-app typecheck (at or below the
  recorded baseline). The full suite, integration tests and build run once, at finalization.
- Test volume is a signal, not a target.
- "Also update" (a task file's or quick-fix `task.md`'s list): every existing test that asserts the
  behaviour being changed, contract and end-to-end spec, `docs/` section, `ai/` file (business-rule
  registry, Tier 0 rows, a skill's `project.md`) and user-facing doc that describes it, or "none
  found". Find them by searching the behaviour's names, routes, fields, messages and rule wording;
  change what a stale test asserts, never delete it to make it pass.

## Baseline (not green today)

Per `docs/security-remediation.md` (2026-09-20; re-measure first): `tsc --noEmit` fails in backend
and storefront (`next build` hides it); quote HTTP specs, one BC module test, 3 storefront and 1 CMS
test fail. No CI runs backend or storefront tests. Backend tests abort unless
`BUSINESS_CENTRAL_DISCOVERY_URL` is an allowed test environment (`integration-tests/global-setup.ts`).

## Whole-branch checks

- New modules are registered in `apps/backend/medusa-config.ts`.
- Company-scoped store routes use `api/middlewares/ensure-role.ts`.
- New UI text is a translation key (`react/jsx-no-literals`).
- Only `NEXT_PUBLIC_*` variables reach client code; other secrets stay server-side.
