# Task 03: Integration Tests for BC Integration Admin API

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 03
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-158 (from develop)
**Depends on:** Task 01

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Test command:** `cd apps/backend && pnpm test:integration:http`
- **Test framework:** Jest, `medusaIntegrationTestRunner` from `@medusajs/test-utils`
- **Test location:** `apps/backend/integration-tests/http/**/*.spec.ts`
- **Naming conventions:** test files kebab-case `.spec.ts`, test names describe behaviour.

## Context

Tests cover the admin API routes from Task 01. They do **not** test the widget's UI — no browser
or E2E test infrastructure exists for admin widgets in this project.

The tests follow the existing pattern in `apps/backend/integration-tests/http/` (e.g.
`companies/companies.spec.ts`), using `medusaIntegrationTestRunner` with `getContainer()`.

### Test setup

Each test needs:
1. An admin user (for authenticated API calls) — created via the user module.
2. An order with specific `bc_integration_state` metadata — created via `orderModuleService`
   directly (same pattern as NIMBUS-129 Task 03's `createOrders` call).
3. API calls via the admin API key or session token — following the existing test pattern for
   authenticated admin routes.

### Mocking the BC submission workflow

The POST route fires NIMBUS-148's workflow asynchronously. In tests, the workflow may not be
fully implemented (NIMBUS-148 is TODO). The tests should:

- Verify the POST route's **HTTP contract** (status code, response shape, concurrency guard).
- Not depend on the workflow's actual BC integration logic.
- If the workflow is not yet implemented, the POST route's fire-and-forget call will either
  no-op or throw asynchronously (unhandled, but the route has already returned 202). The test
  verifies the 202 response, not the workflow's outcome.

If the workflow module is not registered at test time, the POST route should handle that
gracefully (return 500 or a clear error). The test for this case verifies the error response,
not a successful submission.

## Solution Design

### New File: `apps/backend/integration-tests/http/admin/bc-integration.spec.ts`

```typescript
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IOrderModuleService } from '@medusajs/framework/types';

jest.setTimeout(60 * 1000);

// TODO: Replace with actual metadata key name from NIMBUS-149
const BC_INTEGRATION_STATE_KEY = 'bc_integration_state';

const createOrderWithBcState = async (
  orderModuleService: IOrderModuleService,
  bcState: Record<string, unknown> | null
) => {
  return orderModuleService.createOrders({
    currency_code: 'DKK',
    email: 'test@example.com',
    metadata: bcState
      ? { [BC_INTEGRATION_STATE_KEY]: bcState }
      : {},
  });
};

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ getContainer }) => {
    let orderModuleService: IOrderModuleService;

    beforeEach(() => {
      const container = getContainer();
      orderModuleService = container.resolve(Modules.ORDER);
    });

    describe('GET /admin/orders/:id/bc-integration', () => {
      it('TC-1: returns the BC integration state for an order with pending status', async () => {
        const order = await createOrderWithBcState(orderModuleService, {
          bc_order_id: null,
          status: 'pending',
          timestamp: '2026-09-02T10:00:00Z',
          retry_count: 0,
        });

        // TODO: make authenticated GET request
        // const response = await api.get(`/admin/orders/${order.id}/bc-integration`);
        // expect(response.status).toEqual(200);
        // expect(response.data.bc_integration.status).toEqual('pending');
        // expect(response.data.bc_integration.bc_order_id).toBeNull();
        // expect(response.data.bc_integration.retry_count).toEqual(0);
      });

      it('TC-2: returns the BC order ID for an order with sent status', async () => {
        const order = await createOrderWithBcState(orderModuleService, {
          bc_order_id: 'BC-ORD-12345',
          status: 'sent',
          timestamp: '2026-09-02T11:00:00Z',
          retry_count: 1,
        });

        // TODO: make authenticated GET request
        // expect(response.data.bc_integration.status).toEqual('sent');
        // expect(response.data.bc_integration.bc_order_id).toEqual('BC-ORD-12345');
        // expect(response.data.bc_integration.retry_count).toEqual(1);
      });

      it('TC-3: returns null status for an order without BC integration metadata', async () => {
        const order = await createOrderWithBcState(orderModuleService, null);

        // TODO: make authenticated GET request
        // expect(response.data.bc_integration.status).toBeNull();
        // expect(response.data.bc_integration.bc_order_id).toBeNull();
        // expect(response.data.bc_integration.retry_count).toEqual(0);
      });

      it('TC-4: returns 404 for a non-existent order', async () => {
        // TODO: make authenticated GET request to /admin/orders/non-existent-id/bc-integration
        // expect(response.status).toEqual(404);
      });

      it('TC-5: does not expose the raw canonical payload in the response', async () => {
        const order = await createOrderWithBcState(orderModuleService, {
          bc_order_id: null,
          status: 'pending',
          timestamp: '2026-09-02T10:00:00Z',
          retry_count: 0,
        });

        // Also add a canonical_order key to metadata to verify it's not returned
        await orderModuleService.updateOrders(order.id, {
          metadata: {
            [BC_INTEGRATION_STATE_KEY]: {
              bc_order_id: null,
              status: 'pending',
              timestamp: '2026-09-02T10:00:00Z',
              retry_count: 0,
            },
            canonical_order: { externalOrderNumber: 'SECRET', lines: [] },
          },
        });

        // TODO: make authenticated GET request
        // expect(response.data).not.toHaveProperty('canonical_order');
        // expect(JSON.stringify(response.data)).not.toContain('SECRET');
      });
    });

    describe('POST /admin/orders/:id/bc-integration/submit', () => {
      it('TC-6: starts submission and returns 202 for a pending order', async () => {
        const order = await createOrderWithBcState(orderModuleService, {
          bc_order_id: null,
          status: 'pending',
          timestamp: '2026-09-02T10:00:00Z',
          retry_count: 0,
        });

        // TODO: make authenticated POST request with { force_resend: false }
        // expect(response.status).toEqual(202);
        // expect(response.data.message).toContain('started');
      });

      it('TC-7: starts force resend and returns 202 when force_resend is true', async () => {
        const order = await createOrderWithBcState(orderModuleService, {
          bc_order_id: 'BC-ORD-12345',
          status: 'sent',
          timestamp: '2026-09-02T11:00:00Z',
          retry_count: 1,
        });

        // TODO: make authenticated POST request with { force_resend: true }
        // expect(response.status).toEqual(202);
        // expect(response.data.message).toContain('Force resend');
      });

      it('TC-8: returns 409 when a submission is already in progress', async () => {
        const order = await createOrderWithBcState(orderModuleService, {
          bc_order_id: null,
          status: 'pending',
          timestamp: new Date().toISOString(),
          retry_count: 1,
        });

        // TODO: make authenticated POST request with { force_resend: false }
        // expect(response.status).toEqual(409);
        // expect(response.data.code).toEqual('SUBMISSION_IN_PROGRESS');
      });

      it('TC-9: returns 400 when force_resend is not a boolean', async () => {
        const order = await createOrderWithBcState(orderModuleService, {
          bc_order_id: null,
          status: 'pending',
          timestamp: '2026-09-02T10:00:00Z',
          retry_count: 0,
        });

        // TODO: make authenticated POST request with { force_resend: "yes" }
        // expect(response.status).toEqual(400);
      });

      it('TC-10: returns 404 for a non-existent order', async () => {
        // TODO: make authenticated POST request to /admin/orders/non-existent-id/bc-integration/submit
        // expect(response.status).toEqual(404);
      });
    });
  });
});
```

## Test Cases Summary

| # | Description | Route | Expected Status |
|---|-------------|-------|-----------------|
| TC-1 | GET returns pending integration state | GET | 200 |
| TC-2 | GET returns sent status with BC order ID | GET | 200 |
| TC-3 | GET returns null status for untracked order | GET | 200 |
| TC-4 | GET returns 404 for non-existent order | GET | 404 |
| TC-5 | GET does not expose raw canonical payload | GET | 200 (no `canonical_order` in response) |
| TC-6 | POST starts submission for pending order | POST | 202 |
| TC-7 | POST starts force resend for sent order | POST | 202 |
| TC-8 | POST returns 409 when submission in progress | POST | 409 |
| TC-9 | POST returns 400 for invalid body | POST | 400 |
| TC-10 | POST returns 404 for non-existent order | POST | 404 |

## Impacted Files

- **New:** `apps/backend/integration-tests/http/admin/bc-integration.spec.ts`

## Open Items

- **Authenticated API calls in tests** — the existing test files (e.g. `companies.spec.ts`) show
  the pattern for making authenticated admin API calls in the test runner. The implementor should
  follow that pattern (creating an admin user, generating a token, and passing it in the
  Authorization header).
- **NIMBUS-148 workflow availability** — if NIMBUS-148's workflow is not implemented at test time,
  the POST tests (TC-6, TC-7) verify the HTTP contract (202 response) but not the workflow's
  actual execution. The fire-and-forget call may throw asynchronously, but the route has already
  returned 202 by then.
- **Concurrency guard test (TC-8)** — the exact in-progress status value depends on NIMBUS-148.
  The test uses `'pending'` as a placeholder; the implementor must reconcile with the actual
  value.
- **Reconcile `BC_INTEGRATION_STATE_KEY`** — same as Task 01.
