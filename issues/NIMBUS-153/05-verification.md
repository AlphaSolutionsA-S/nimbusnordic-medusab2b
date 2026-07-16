# Task 05: Verification and Build Check

## Objective

Confirm that the full migration is complete: the project builds, the module loads at startup, and the route contract is preserved end-to-end.

## Verification Steps

### 1. Full workspace build

```bash
pnpm build
```

Expected: Build succeeds with zero errors.

### 2. TypeScript check (backend only)

```bash
cd apps/backend && npx tsc --noEmit
```

Expected: No type errors.

### 3. Lint check

```bash
pnpm lint
```

Expected: No new lint errors introduced.

### 4. Backend startup smoke test

```bash
cd apps/backend && pnpm backend:dev
```

Expected: Backend starts without module resolution errors. Look for log lines confirming module loading.

### 5. Route connectivity smoke test

```bash
curl http://localhost:9000/store/business-central/operations
```

Expected (with valid BC credentials): `200` response with `{ "operations": { ... } }`
Expected (without valid BC credentials): Error response with appropriate MedusaError message.

### 6. No remaining imports of old utility

```bash
grep -r "business-central-client" apps/ --include="*.ts"
```

Expected: Zero results (or only storefront compatibility references if they exist).

## Test Cases

### TC-1: Build passes
- **Given:** All 4 prior tasks are completed
- **When:** `pnpm build` is run
- **Then:** Exit code 0, no errors

### TC-2: Module loads at startup
- **Given:** Backend starts with updated config
- **When:** Medusa DI container initializes
- **Then:** `businessCentral` module service is resolvable

### TC-3: Route response parity
- **Given:** Same environment and credentials as before migration
- **When:** `GET /store/business-central/operations` is called
- **Then:** Response body shape is identical to pre-migration response

## Implementation Steps

1. Run `pnpm build` from repo root — fix any errors
2. Run `pnpm lint` — fix any new warnings/errors
3. Start backend dev server and verify no startup errors
4. Test the operations endpoint manually or via curl
5. Confirm no stale imports remain
