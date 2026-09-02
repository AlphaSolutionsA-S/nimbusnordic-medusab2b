# Task 01: Order Ingestion Module (canonical contract + dedupe-index model) — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 01
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-129-order-ingestion (from develop)
**Depends on:** None

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:modules`
- **Test framework:** Jest (`@swc/jest`, node environment)
- **Test location:** `apps/backend/src/modules/order-ingestion/__tests__/*.[jt]s` (matched by
  `**/src/modules/*/__tests__/**/*.[jt]s`)
- **Naming conventions:** directories kebab-case, files kebab-case for services/modules, module
  registration **names** camelCase (never kebab-case), variables/functions camelCase,
  types/interfaces PascalCase.

## Context — this task was redesigned; read before implementing

**This is a rework, not the original design.** The original plan (before this revision) had this
module hold a full `IncomingOrder` audit/state-machine row for every submission, because order
processing (NIMBUS-147's validation/matching, and eventually NIMBUS-149's order creation) was
going to happen **asynchronously**, after the API responded — so something needed to track
"received but not yet processed" state.

**The architecture changed**: canonical validation, company matching, the duplicate check, AND
real Medusa `Order` creation (header-only — see Task 03) now all happen **synchronously**, inside
the request. There is no more "received, awaiting async processing" state to track, and a
rejected submission is no longer persisted anywhere — it's just a validation error returned
directly, nothing lingers. This means most of the original `IncomingOrder` model's job
disappeared entirely.

**What's left, and why it's still needed**: the per-company duplicate check (NIMBUS-147's
confirmed requirement — same `externalOrderNumber` from two different companies is NOT a
duplicate) needs a **fast, reliable, indexed lookup**. The real Medusa `Order` entity has no
native `external_order_number` column — that value only exists inside the canonical payload,
which would have to be stored in `order.metadata` (a JSON column). Filtering/querying by a nested
key inside a JSON `metadata` column via Medusa's `query.graph()` is not a confirmed-reliable
pattern in this codebase or in the `building-with-medusa` skill's documented query patterns —
guessing at JSON-filter syntax for a correctness-critical duplicate check (the literal reason
NIMBUS-147 exists) was judged too risky. So this module keeps a **minimal dedupe-index table**,
`OrderExternalReference`, populated only when an order is successfully created, existing purely
to make `(company_id, external_order_number)` a real, reliably-queryable indexed pair.

The module also still holds the **canonical order contract** (`CanonicalOrderSchema`, Task 02) —
that part of the original design is unaffected by this rework and stays exactly where it was.

**Module name unchanged** (`orderIngestion`) for continuity/minimal churn — it still accurately
describes "the order-ingestion feature area" (the canonical contract + the dedupe index for
ingested orders), even though the specific data model inside it changed shape and name.

## Solution Design

```
apps/backend/src/modules/order-ingestion/
├── models/
│   └── order-external-reference.ts
├── service.ts
└── index.ts
```

`OrderExternalReference` fields — deliberately minimal:

| Field | Purpose |
|---|---|
| `id` (`oref_...`) | Primary key |
| `external_order_number` | From the canonical payload's `externalOrderNumber` — the dedupe key |
| `company_id` | The matched Medusa `Company` id (see Task 03) — duplicate scope is per-company |
| `order_id` | The real Medusa `Order` id this reference belongs to |

No `status`, `raw_payload`, `validation_errors`, or `processed_at` fields — those concepts
belonged to the old async-staging design and no longer apply (a row here only ever represents a
*successfully created* order; nothing is ever written here for a rejected submission).

**Known limitation, not solved by this task (flagged, not silently ignored)**: there is no
database-level uniqueness constraint enforcing one row per `(company_id, external_order_number)`
pair. Medusa's model DSL (`model.text().unique()`) only supports single-column uniqueness in the
patterns already used elsewhere in this repo (e.g. `company.ts`); a compound unique index would
need DML syntax this project has no existing example of, and guessing at it risked a broken
migration. In practice this means two truly concurrent, identical submissions could both pass the
duplicate check before either has committed and create two orders. This is a real, acknowledged
race-condition gap — recorded in PLAN.md as a follow-up hardening item, not solved here.

## Code Skeletons

### New File: `apps/backend/src/modules/order-ingestion/models/order-external-reference.ts`

```typescript
import { model } from '@medusajs/framework/utils';

export const OrderExternalReference = model.define('order_external_reference', {
  id: model.id({ prefix: 'oref' }).primaryKey(),
  external_order_number: model.text(),
  company_id: model.text(),
  order_id: model.text(),
});

export default OrderExternalReference;
```

### New File: `apps/backend/src/modules/order-ingestion/service.ts`

```typescript
import { MedusaService } from '@medusajs/framework/utils';
import OrderExternalReference from './models/order-external-reference';

class OrderIngestionModuleService extends MedusaService({
  OrderExternalReference,
}) {}

export default OrderIngestionModuleService;
```

This auto-generates: `createOrderExternalReferences`, `listOrderExternalReferences`,
`listAndCountOrderExternalReferences`, `retrieveOrderExternalReference`,
`updateOrderExternalReferences`, `deleteOrderExternalReferences`,
`softDeleteOrderExternalReferences`, `restoreOrderExternalReferences`. Filters passed to
`listOrderExternalReferences` may reference any column directly, e.g.
`{ external_order_number: '...', company_id: '...' }`.

### New File: `apps/backend/src/modules/order-ingestion/index.ts`

```typescript
import { Module } from '@medusajs/framework/utils';
import OrderIngestionModuleService from './service';

export const ORDER_INGESTION_MODULE = 'orderIngestion';

export default Module(ORDER_INGESTION_MODULE, {
  service: OrderIngestionModuleService,
});
```

**Critical:** the module registration name is `'orderIngestion'` (camelCase, no dashes) even
though the directory is `order-ingestion` (kebab-case) — this exactly mirrors the existing
`businessCentral` module (dir `business-central`, key `'businessCentral'`).

## Impacted Files

### Modified: `apps/backend/medusa-config.ts`

Add the import and registration entry. Current file (verbatim, for exact context):

```typescript
import { QUOTE_MODULE } from './src/modules/quote';
import { APPROVAL_MODULE } from './src/modules/approval';
import { COMPANY_MODULE } from './src/modules/company';
import { BUSINESS_CENTRAL_MODULE } from './src/modules/business-central';
import { loadEnv, defineConfig } from '@medusajs/framework/utils';

loadEnv(process.env.NODE_ENV || 'development', process.cwd());

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  modules: {
    [COMPANY_MODULE]: { resolve: './modules/company' },
    [QUOTE_MODULE]: { resolve: './modules/quote' },
    [APPROVAL_MODULE]: { resolve: './modules/approval' },
    [BUSINESS_CENTRAL_MODULE]: { resolve: './modules/business-central' },
    ['notification']: {
      resolve: '@medusajs/medusa/notification',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/notification-local',
            id: 'local',
            options: { channels: ['email'] },
          },
        ],
      },
    },
  },
});
```

Change to (add one import line, add one entry to the `modules` map — do not reformat or touch
anything else in this file):

```typescript
import { QUOTE_MODULE } from './src/modules/quote';
import { APPROVAL_MODULE } from './src/modules/approval';
import { COMPANY_MODULE } from './src/modules/company';
import { BUSINESS_CENTRAL_MODULE } from './src/modules/business-central';
import { ORDER_INGESTION_MODULE } from './src/modules/order-ingestion';
import { loadEnv, defineConfig } from '@medusajs/framework/utils';

loadEnv(process.env.NODE_ENV || 'development', process.cwd());

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  modules: {
    [COMPANY_MODULE]: { resolve: './modules/company' },
    [QUOTE_MODULE]: { resolve: './modules/quote' },
    [APPROVAL_MODULE]: { resolve: './modules/approval' },
    [BUSINESS_CENTRAL_MODULE]: { resolve: './modules/business-central' },
    [ORDER_INGESTION_MODULE]: { resolve: './modules/order-ingestion' },
    ['notification']: {
      resolve: '@medusajs/medusa/notification',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/notification-local',
            id: 'local',
            options: { channels: ['email'] },
          },
        ],
      },
    },
  },
});
```

## Test Cases

Create `apps/backend/src/modules/order-ingestion/__tests__/order-ingestion.spec.ts` using
`moduleIntegrationTestRunner` from `@medusajs/test-utils`, same as the pre-revision plan (this
repo has no other DB-backed module test to copy from — the only precedent, `business-central`, is
a stateless module with no data model). If the exact generic/parameter shape below does not match
what TypeScript resolves from `node_modules/@medusajs/test-utils`, consult that package's type
declarations before changing anything else — this is the one place in this project where
consulting a library's own types directly is expected, since there's no in-repo example to copy.

```typescript
// apps/backend/src/modules/order-ingestion/__tests__/order-ingestion.spec.ts
import { moduleIntegrationTestRunner } from '@medusajs/test-utils';
import { ORDER_INGESTION_MODULE } from '../index';
import OrderIngestionModuleService from '../service';

moduleIntegrationTestRunner<OrderIngestionModuleService>({
  moduleName: ORDER_INGESTION_MODULE,
  resolve: './src/modules/order-ingestion',
  testSuite: ({ service }) => {
    describe('OrderIngestionModuleService', () => {
      it('TC-1: creates and retrieves an order external reference (happy path)', async () => {
        const created = await service.createOrderExternalReferences({
          external_order_number: 'NKT004061',
          company_id: 'comp_123',
          order_id: 'order_123',
        });

        expect(created.id).toEqual(expect.stringMatching(/^oref_/));

        const retrieved = await service.retrieveOrderExternalReference(created.id);
        expect(retrieved.external_order_number).toEqual('NKT004061');
        expect(retrieved.company_id).toEqual('comp_123');
        expect(retrieved.order_id).toEqual('order_123');
      });

      it('TC-2: lists references filtered by (external_order_number, company_id) — the exact lookup Task 03 uses for the duplicate check', async () => {
        await service.createOrderExternalReferences({
          external_order_number: 'FLS190518',
          company_id: 'comp_A',
          order_id: 'order_A',
        });
        await service.createOrderExternalReferences({
          external_order_number: 'FLS190518',
          company_id: 'comp_B',
          order_id: 'order_B',
        });

        const matchesForA = await service.listOrderExternalReferences({
          external_order_number: 'FLS190518',
          company_id: 'comp_A',
        });

        expect(matchesForA).toHaveLength(1);
        expect(matchesForA[0].order_id).toEqual('order_A');
      });

      it('TC-3: confirms the same external_order_number across two different companies produces two independent rows (edge case: per-company scoping, not a global uniqueness)', async () => {
        await service.createOrderExternalReferences({
          external_order_number: 'CROSS-COMPANY-1',
          company_id: 'comp_A',
          order_id: 'order_A2',
        });
        await service.createOrderExternalReferences({
          external_order_number: 'CROSS-COMPANY-1',
          company_id: 'comp_B',
          order_id: 'order_B2',
        });

        const all = await service.listOrderExternalReferences({
          external_order_number: 'CROSS-COMPANY-1',
        });

        expect(all).toHaveLength(2);
      });
    });
  },
});
```

Run with: `cd apps/backend && pnpm test:integration:modules`.

## Implementation Steps

1. Create `apps/backend/src/modules/order-ingestion/models/order-external-reference.ts` exactly
   as shown above. (If you previously created `models/incoming-order.ts` from an earlier revision
   of this plan, delete it — it's superseded, not kept alongside the new model.)
2. Create `apps/backend/src/modules/order-ingestion/service.ts` exactly as shown above.
3. Create `apps/backend/src/modules/order-ingestion/index.ts` exactly as shown above (module name
   `orderIngestion` is unchanged from any earlier revision).
4. Edit `apps/backend/medusa-config.ts` exactly as shown in "Impacted Files" above — add the
   import and the one `modules` map entry only (if already added by an earlier revision, no
   change needed here).
5. Generate the migration: `cd apps/backend && npx medusa db:generate orderIngestion`. If this
   exact module-name argument is rejected by the CLI, retry with `order-ingestion` (the directory
   name).
6. Run the migration: `cd apps/backend && npx medusa db:migrate` (no arguments).
7. Write the test file exactly as shown above.
8. Run `cd apps/backend && pnpm test:integration:modules` and confirm all three test cases pass.
9. Run `pnpm build` from the repo root (or `cd apps/backend && pnpm build`) and fix any type
   errors before marking this task done.
