# Task 05: Trigger — Subscriber on `order_ingestion.ready_for_business_central` — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 05
**Date:** 2026-09-29 (revised; supersedes the 2026-09-02 version)
**Branch:** feature/NIMBUS-148 (from develop)
**Depends on:** Task 04

---

## What changed since the 2026-09-02 plan (read first)

1. **No longer blocked.** NIMBUS-129 Task 04 is implemented and merged on `develop`:
   - `apps/backend/src/workflows/order-ingestion/workflows/enrich-order.ts` exports
     `READY_FOR_BUSINESS_CENTRAL_EVENT = "order_ingestion.ready_for_business_central"` and emits it
     with `emitEventStep({ eventName, data: input })`, so the event payload is `{ order_id: string }`.
   - `apps/backend/src/subscribers/order-ingestion-created.ts` is the existing subscriber precedent
     (default-exported handler, `config.event` from an imported constant, `SubscriberArgs` /
     `SubscriberConfig` from `@medusajs/medusa`).
   - Nothing subscribes to `order_ingestion.ready_for_business_central` yet.
   The old "fallback if NIMBUS-129 is not coming soon" section is removed.
2. **New: integration tests fail closed unless BC points at an allowed TEST environment.** The
   BC tenant in `apps/backend/.env` (loaded by `jest.config.js` via `loadEnv("test", …)`) is a
   **test** tenant (environment `TestDK`), and the user accepts that integration tests call it
   (2026-09-29). Once this subscriber exists, the event-chain and orderapi suites trigger real BC
   calls against it. To make sure that can never happen against production, a Jest `globalSetup`
   parses the environment segment of `BUSINESS_CENTRAL_DISCOVERY_URL` and aborts the whole
   `integration:http` / `integration:modules` run unless it is on the allowlist
   `BUSINESS_CENTRAL_TEST_ENVIRONMENTS` (comma-separated, default `TestDK`). The earlier
   fake-credentials idea is dropped.
3. **New: one existing assertion becomes racy and is adapted.** `enrich-order-event-chain.spec.ts`
   TC-4 deep-compares `business_central_integration` before and after `enrichOrderWorkflow`. The new
   subscriber may already have recorded an attempt by the time the test reads the order. The test
   is narrowed to what `enrichOrderWorkflow` itself guarantees (the key survives with its
   `initialized_at`). This is the only edit to a NIMBUS-129/149 file.

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root)
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:http` (run suites individually if the
  known hook-timeout flake appears)
- **Test framework:** Jest with `medusaIntegrationTestRunner` (`inApp: true`)
- **Test location:** `apps/backend/integration-tests/http/**/*.spec.ts`
- **Naming conventions:** subscriber files are kebab-case in `apps/backend/src/subscribers/`, with a
  **default-exported** handler and a named `config` export (Medusa's loader requires it — the one
  place a default export is correct). Auto-discovered; no `medusa-config.ts` change.
- **Quote style:** **double quotes**, 2-space indent.

## The trigger decision

**A Medusa event subscriber on `order_ingestion.ready_for_business_central`.** That event exists on
`develop` specifically as the NIMBUS-148 boundary, it is emitted after the synchronous 201 has
already been returned (route → `order_ingestion.order_created` → `enrichOrderWorkflow` →
`ready_for_business_central`), so BC work never extends the caller's response, and the subscriber
only runs the reusable workflow — NIMBUS-158 adds its own caller without touching this file.

Rejected: calling the BC workflow from inside `enrichOrderWorkflow` (a BC outage would fail and
compensate enrichment), and a scheduled poller (a later *recovery* mechanism, not the trigger).

Errors are logged and swallowed, per the `building-with-medusa` subscriber guidance ("Log errors but
don't throw"). Business failures are already recorded on the order by the workflow, so a caught
error here is genuinely exceptional (order vanished, container failure).


## What tests may now do against Business Central

- Integration suites **may call the test BC tenant** configured in `apps/backend/.env`. The
  event-chain and orderapi suites seed companies with fake customer numbers (`tc2-event-customer`,
  `tc7-http-customer`, …), so the subscriber's real `getCustomer` call returns no customer and the
  order is recorded `failed` / `bc_customer_not_found`. No sales order is created in the test
  tenant by those suites. The NIMBUS-148 suites stub all three BC methods.
- **`.env` must never point at a production BC environment when tests run.** The `globalSetup`
  guard below enforces that for the discovery URL.
- **Why only an environment-name allowlist (user decision 2026-09-29).** Checking that the
  environment's *type* is `Sandbox` via the BC Admin Center API was verified on 2026-09-29 as **not
  possible** with the current app registration: its token has only the `API.ReadWrite.All` role,
  and `GET /admin/v2.24/.../environments` and `GET /admin/v2.21/.../environments` return `401`.
  Enabling it would need `AdminCenter.ReadWrite.All` (there is no read-only Admin Center scope),
  so it is deliberately out of scope. Any future type check must use a **separate test-only app
  registration**, never the integration's own app.

## Code Skeletons

### New File: `apps/backend/src/subscribers/business-central-order-ready.ts`

```typescript
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { READY_FOR_BUSINESS_CENTRAL_EVENT } from "../workflows/order-ingestion/workflows/enrich-order";
import { sendOrderToBusinessCentralWorkflow } from "../workflows/business-central-order/workflows/send-order-to-business-central";

type ReadyForBusinessCentralEventData = {
  order_id: string;
};

export default async function businessCentralOrderReadyHandler({
  event: { data },
  container,
}: SubscriberArgs<ReadyForBusinessCentralEventData>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    const { result } = await sendOrderToBusinessCentralWorkflow(container).run({
      input: { order_id: data.order_id },
    });

    logger.info(
      `Business Central submission for order ${data.order_id} finished with status ${result.status}`
    );
  } catch (error) {
    // Business failures are already recorded on the order's integration state by the workflow.
    // Reaching here means something exceptional happened. Log and stop; never throw from a
    // subscriber.
    logger.error(
      `Business Central submission for order ${data.order_id} could not run: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }
}

export const config: SubscriberConfig = {
  event: READY_FOR_BUSINESS_CENTRAL_EVENT,
};
```

Notes: import the constant (never restate the string); no duplicate check here — the guard lives in
`prepareBcOrderStep` so every caller shares it. The workflow rejects with a serialized plain object,
which the `"unknown error"` fallback covers.

### New File: `apps/backend/src/utils/business-central-test-environment.ts`

Pure, no Medusa imports, so it can be used from Jest's `globalSetup` and unit-tested.

```typescript
const BUSINESS_CENTRAL_API_HOST = "api.businesscentral.dynamics.com";
const DEFAULT_BUSINESS_CENTRAL_TEST_ENVIRONMENTS = "TestDK";

/**
 * Extracts the environment segment from a Business Central discovery URL of the form
 * https://api.businesscentral.dynamics.com/v2.0/<tenant>/<environment>/api/v2.0.
 * Returns null when the URL is missing or does not have that shape.
 */
export function parseBusinessCentralEnvironment(
  discoveryUrl: string | undefined
): string | null {
  if (!discoveryUrl) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(discoveryUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.hostname !== BUSINESS_CENTRAL_API_HOST) {
    return null;
  }

  const [apiVersion, tenant, environment] = url.pathname.split("/").filter(Boolean);

  if (apiVersion !== "v2.0" || !tenant || !environment) {
    return null;
  }

  return environment;
}

/**
 * Comma-separated allowlist from BUSINESS_CENTRAL_TEST_ENVIRONMENTS. A blank or unset value falls
 * back to the default, the same pattern as BUSINESS_CENTRAL_LCY_CODE.
 */
export function parseAllowedBusinessCentralTestEnvironments(
  value: string | undefined
): string[] {
  const configured = value?.trim() ? value : DEFAULT_BUSINESS_CENTRAL_TEST_ENVIRONMENTS;

  return configured
    .split(",")
    .map((environment) => environment.trim())
    .filter(Boolean);
}

/**
 * Fails closed unless BUSINESS_CENTRAL_DISCOVERY_URL targets an allowed test environment. The
 * error messages contain only the environment name — never the URL, tenant id, client id or
 * secret.
 */
export function assertBusinessCentralTestEnvironment(
  env: Readonly<Record<string, string | undefined>>
): string {
  const environment = parseBusinessCentralEnvironment(
    env.BUSINESS_CENTRAL_DISCOVERY_URL
  );

  if (!environment) {
    throw new Error(
      "Refusing to run integration tests: BUSINESS_CENTRAL_DISCOVERY_URL is missing or is not a valid Business Central discovery URL"
    );
  }

  const allowed = parseAllowedBusinessCentralTestEnvironments(
    env.BUSINESS_CENTRAL_TEST_ENVIRONMENTS
  );

  if (!allowed.includes(environment)) {
    throw new Error(
      `Refusing to run integration tests against Business Central environment '${environment}' — not an allowed test environment`
    );
  }

  return environment;
}
```

Matching is exact and case-sensitive (`TestDK` ≠ `testdk`), which errs on the side of refusing.

### New File: `apps/backend/integration-tests/global-setup.ts`

```typescript
import { assertBusinessCentralTestEnvironment } from "../src/utils/business-central-test-environment";

// Test types whose suites can reach Business Central (directly or via the NIMBUS-148 subscriber).
const BUSINESS_CENTRAL_TEST_TYPES = ["integration:http", "integration:modules"];

export default async function globalSetup(): Promise<void> {
  if (!BUSINESS_CENTRAL_TEST_TYPES.includes(process.env.TEST_TYPE ?? "")) {
    return;
  }

  // Throws before any suite starts, so the whole run aborts.
  assertBusinessCentralTestEnvironment(process.env);
}
```

`globalSetup` runs once in Jest's main process, after `jest.config.js` has already run
`loadEnv("test", __dirname)`, so `.env` values are in `process.env`. A throw aborts the entire run —
unlike `setupFiles` (`integration-tests/setup.js`), which runs per test file and would only fail
each suite individually. `setup.js` is therefore left unchanged.

### Modified File: `apps/backend/jest.config.js`

Add one property to the `module.exports` object, after `setupFiles`:

```js
  setupFiles: ["./integration-tests/setup.js"],
  globalSetup: "./integration-tests/global-setup.ts",
```

Nothing else changes. Jest transforms `globalSetup` with the configured `@swc/jest` transform and
hooks `require` so the imported `.ts` module is transformed too. **If** Jest reports it cannot parse
`global-setup.ts`, rename it to `global-setup.js`, write it as CommonJS
(`module.exports = async function globalSetup() { … }`) and `require` the TS util; do not inline or
weaken the check.

### Modified File: `apps/backend/.env.template`

Add below `BUSINESS_CENTRAL_LCY_CODE=DKK`:

```
# Comma-separated Business Central environments integration tests may reach (default TestDK).
# Tests abort if BUSINESS_CENTRAL_DISCOVERY_URL targets any other environment.
BUSINESS_CENTRAL_TEST_ENVIRONMENTS=TestDK
```

### Modified File: `apps/backend/integration-tests/http/order-ingestion/enrich-order-event-chain.spec.ts`

Still needed: the subscriber runs asynchronously after `enrichOrderWorkflow` and records an attempt
(now `bc_customer_not_found` after a real test-tenant `getCustomer` call). In `TC-4`, replace only:

```typescript
        expect(after.metadata?.[BC_INTEGRATION_STATE_METADATA_KEY]).toEqual(
          before.metadata?.[BC_INTEGRATION_STATE_METADATA_KEY]
        );
```

with:

```typescript
        // enrichOrderWorkflow emits order_ingestion.ready_for_business_central, whose NIMBUS-148
        // subscriber may already have recorded a Business Central attempt by now. What enrichment
        // itself guarantees is that it neither drops nor resets the integration state.
        const beforeState = before.metadata?.[BC_INTEGRATION_STATE_METADATA_KEY] as {
          initialized_at: string | null;
        };
        const afterState = after.metadata?.[BC_INTEGRATION_STATE_METADATA_KEY] as
          | { initialized_at: string | null }
          | undefined;

        expect(afterState).toBeDefined();
        expect(afterState?.initialized_at).toEqual(beforeState.initialized_at);
```

Do not change anything else in that file.

## Impacted Files

| File | Change |
|---|---|
| `apps/backend/src/subscribers/business-central-order-ready.ts` | **New** |
| `apps/backend/src/utils/business-central-test-environment.ts` | **New** |
| `apps/backend/src/utils/__tests__/business-central-test-environment.unit.spec.ts` | **New** |
| `apps/backend/integration-tests/global-setup.ts` | **New** |
| `apps/backend/integration-tests/http/business-central-order/bc-order-ready-subscriber.spec.ts` | **New** |
| `apps/backend/jest.config.js` | Add `globalSetup` |
| `apps/backend/.env.template` | Document `BUSINESS_CENTRAL_TEST_ENVIRONMENTS` |
| `apps/backend/integration-tests/http/order-ingestion/enrich-order-event-chain.spec.ts` | Narrow one TC-4 assertion |

`apps/backend/integration-tests/setup.js` is **not** modified.

## Test Cases

### TC-1: the handler runs the submission workflow for the event's order (happy path)
- **Given:** a seeded order (company with BC customer number, `singleLineCanonicalOrder`, pending
  state); BC stubbed (`getCustomer` DKK, line 1 resolves and is accepted)
- **When:** the default-exported handler is invoked with `{ event: { data: { order_id } }, container }`
- **Then:** state `sent`, `bc_order_id` set, `attempt_count: 1`

### TC-2: the handler never throws when the workflow rejects (edge case)
- **Given:** an `order_id` that does not exist
- **Then:** the handler promise resolves to `undefined`

### TC-3: registered for the exact boundary event (wiring)
- **Then:** `config.event` equals `READY_FOR_BUSINESS_CENTRAL_EVENT` and
  `"order_ingestion.ready_for_business_central"`

### TC-4: the real event chain drives the order to `sent` (integration/wiring)
- **When:** `enrichOrderWorkflow` runs (it emits the event)
- **Then:** polling reaches `status === "sent"` within 10 s

### ENV-1: an allowed test environment passes
- **Given:** `.../v2.0/<tenant>/TestDK/api/v2.0`, allowlist unset
- **Then:** returns `"TestDK"`

### ENV-2: a non-allowed environment is refused without leaking the tenant
- **Given:** `.../v2.0/<tenant>/Production/api/v2.0`
- **Then:** throws `Refusing to run integration tests against Business Central environment 'Production' — not an allowed test environment`;
  the message does not contain the tenant id

### ENV-3: a missing discovery URL is refused
- **Given:** no `BUSINESS_CENTRAL_DISCOVERY_URL`
- **Then:** throws the "missing or is not a valid" message

### ENV-4: malformed URLs are refused
- **Given:** `"not a url"`, an `http://` URL, a different host, and a URL with no environment segment
- **Then:** `parseBusinessCentralEnvironment` returns `null` and the assert throws for each

### ENV-5: the allowlist is configurable and blank falls back to the default
- **Given:** `BUSINESS_CENTRAL_TEST_ENVIRONMENTS=" Sandbox , TestDK "` and a `Sandbox` URL; then a
  blank allowlist with a `TestDK` URL
- **Then:** both pass

### New File: `apps/backend/src/utils/__tests__/business-central-test-environment.unit.spec.ts`

Runs under `pnpm test:unit`.

```typescript
import {
  assertBusinessCentralTestEnvironment,
  parseBusinessCentralEnvironment,
} from "../business-central-test-environment";

const TENANT = "00000000-1111-2222-3333-444444444444";

function discoveryUrl(environment: string): string {
  return `https://api.businesscentral.dynamics.com/v2.0/${TENANT}/${environment}/api/v2.0`;
}

describe("assertBusinessCentralTestEnvironment", () => {
  it("ENV-1: accepts the default test environment", () => {
    expect(
      assertBusinessCentralTestEnvironment({
        BUSINESS_CENTRAL_DISCOVERY_URL: discoveryUrl("TestDK"),
      })
    ).toEqual("TestDK");
  });

  it("ENV-2: refuses an environment that is not on the allowlist, without leaking the tenant", () => {
    let message = "";

    try {
      assertBusinessCentralTestEnvironment({
        BUSINESS_CENTRAL_DISCOVERY_URL: discoveryUrl("Production"),
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toEqual(
      "Refusing to run integration tests against Business Central environment 'Production' — not an allowed test environment"
    );
    expect(message).not.toContain(TENANT);
  });

  it("ENV-3: refuses a missing discovery URL", () => {
    expect(() => assertBusinessCentralTestEnvironment({})).toThrow(
      "missing or is not a valid Business Central discovery URL"
    );
  });

  it("ENV-4: refuses malformed discovery URLs", () => {
    const malformed = [
      "not a url",
      `http://api.businesscentral.dynamics.com/v2.0/${TENANT}/TestDK/api/v2.0`,
      `https://example.com/v2.0/${TENANT}/TestDK/api/v2.0`,
      `https://api.businesscentral.dynamics.com/v2.0/${TENANT}`,
    ];

    for (const url of malformed) {
      expect(parseBusinessCentralEnvironment(url)).toBeNull();
      expect(() =>
        assertBusinessCentralTestEnvironment({ BUSINESS_CENTRAL_DISCOVERY_URL: url })
      ).toThrow("Refusing to run integration tests");
    }
  });

  it("ENV-5: honours a configured allowlist and falls back to the default when blank", () => {
    // IMPLEMENT: assert a Sandbox URL passes with
    // BUSINESS_CENTRAL_TEST_ENVIRONMENTS: " Sandbox , TestDK ", and a TestDK URL passes with
    // BUSINESS_CENTRAL_TEST_ENVIRONMENTS: "  ".
  });
});
```

### New File: `apps/backend/integration-tests/http/business-central-order/bc-order-ready-subscriber.spec.ts`

```typescript
import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService } from "@medusajs/framework/types";
import businessCentralOrderReadyHandler, {
  config as businessCentralOrderReadyConfig,
} from "../../../src/subscribers/business-central-order-ready";
import {
  enrichOrderWorkflow,
  READY_FOR_BUSINESS_CENTRAL_EVENT,
} from "../../../src/workflows/order-ingestion/workflows/enrich-order";
import { BUSINESS_CENTRAL_MODULE } from "../../../src/modules/business-central";
import type {
  BCCreatedSalesOrder,
  BCCustomer,
  BCItemLookupResult,
  IBusinessCentralModuleService,
} from "../../../src/modules/business-central/types";
import { COMPANY_MODULE } from "../../../src/modules/company";
import type { ICompanyModuleService } from "../../../src/types";
import {
  BC_INTEGRATION_STATE_METADATA_KEY,
  createInitialBcIntegrationState,
} from "../../../src/modules/order-ingestion/bc-integration-state";
import type { BcIntegrationState } from "../../../src/modules/order-ingestion/bc-integration-state";
import { singleLineCanonicalOrder } from "../../../src/modules/order-ingestion/__fixtures__/canonical-order-fixtures";

jest.setTimeout(60 * 1000);

const BC_CUSTOMER: BCCustomer = {
  number: "579000283084",
  displayName: "METZ A/S",
  email: "",
  phoneNumber: "",
  addressLine1: "Skelstedet 9",
  addressLine2: "",
  city: "Vedbæk",
  state: "",
  postalCode: "2950",
  country: "DK",
  blocked: "not_blocked",
  creditLimit: null,
  taxRegistrationNumber: "",
  currencyCode: "DKK",
};

const LOOKUP_RESULTS: BCItemLookupResult[] = [
  {
    lineNumber: 1,
    matched: true,
    matchedBy: "eanNo",
    item: {
      id: "11111111-1111-1111-1111-111111111111",
      number: "FLS-NIM-VESPERMNA-XL",
      displayName: "Vesper Vest Unisex, Navy - XL",
      gtin: "5712094145752",
      baseUnitOfMeasureCode: "PCS",
    },
  },
];

const CREATED: BCCreatedSalesOrder = {
  id: "22222222-2222-2222-2222-222222222222",
  number: "SO-009999",
  status: "Draft",
  acceptedLineNumbers: [1],
  rejectedLines: [],
};

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ getContainer }) => {
    describe("business-central-order-ready subscriber", () => {
      let counter = 0;

      async function seedOrder() {
        counter += 1;
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );

        const company = await companyService.createCompanies({
          name: `BC Subscriber Co ${counter}`,
          email: `bc-sub-${counter}@example.com`,
          business_central_customer_number: "579000283084",
        });

        return orderModuleService.createOrders({
          currency_code: "dkk",
          metadata: {
            company_id: company.id,
            order_ingestion_state: "created",
            canonical_order: {
              ...singleLineCanonicalOrder,
              externalOrderNumber: `BC-SUB-${counter}`,
            },
            [BC_INTEGRATION_STATE_METADATA_KEY]:
              createInitialBcIntegrationState("2026-09-29T10:00:00.000Z"),
          },
        });
      }

      // Stubs all three BC methods the workflow calls, so these tests never reach the test tenant.
      function stubBusinessCentral() {
        const bcService = getContainer().resolve<IBusinessCentralModuleService>(
          BUSINESS_CENTRAL_MODULE
        );

        jest.spyOn(bcService, "getCustomer").mockResolvedValue(BC_CUSTOMER);
        jest
          .spyOn(bcService, "findItemsForOrderLines")
          .mockResolvedValue(LOOKUP_RESULTS);

        return jest.spyOn(bcService, "createSalesOrder").mockResolvedValue(CREATED);
      }

      async function readIntegrationState(
        orderId: string
      ): Promise<BcIntegrationState | undefined> {
        const orderModuleService = getContainer().resolve<IOrderModuleService>(
          Modules.ORDER
        );
        const persisted = await orderModuleService.retrieveOrder(orderId, {
          select: ["id", "metadata"],
        });
        const metadata = (persisted.metadata ?? {}) as Record<string, unknown>;

        return metadata[BC_INTEGRATION_STATE_METADATA_KEY] as
          | BcIntegrationState
          | undefined;
      }

      async function waitForStatus(
        orderId: string,
        expected: string,
        timeoutMs = 10000
      ): Promise<BcIntegrationState> {
        const start = Date.now();

        while (Date.now() - start < timeoutMs) {
          const state = await readIntegrationState(orderId);

          if (state?.status === expected) {
            return state;
          }

          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        throw new Error(
          `Timed out waiting for order ${orderId} to reach BC status "${expected}"`
        );
      }

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it("TC-1: runs the submission workflow for the order in the event payload", async () => {
        const container = getContainer();
        const order = await seedOrder();
        const createSalesOrder = stubBusinessCentral();

        await businessCentralOrderReadyHandler({
          event: {
            name: READY_FOR_BUSINESS_CENTRAL_EVENT,
            data: { order_id: order.id },
          },
          container,
        } as never);

        expect(createSalesOrder).toHaveBeenCalledTimes(1);

        const state = await readIntegrationState(order.id);
        expect(state?.status).toEqual("sent");
        expect(state?.bc_order_id).toEqual(CREATED.id);
        expect(state?.attempt_count).toEqual(1);
      });

      it("TC-2: resolves instead of throwing when the workflow rejects", async () => {
        // IMPLEMENT: invoke the handler (same `as never` argument shape as TC-1) with
        // data.order_id = "order_does_not_exist" and assert
        // `await expect(handlerPromise).resolves.toBeUndefined()`.
      });

      it("TC-3: is registered for the boundary event the ingestion chain emits", () => {
        expect(businessCentralOrderReadyConfig.event).toEqual(
          READY_FOR_BUSINESS_CENTRAL_EVENT
        );
        expect(businessCentralOrderReadyConfig.event).toEqual(
          "order_ingestion.ready_for_business_central"
        );
      });

      it("TC-4: the real event chain drives the order to sent end to end", async () => {
        const order = await seedOrder();
        stubBusinessCentral();

        await enrichOrderWorkflow(getContainer()).run({
          input: { order_id: order.id },
        });

        const state = await waitForStatus(order.id, "sent");
        expect(state.bc_order_id).toEqual(CREATED.id);
      });
    });
  },
});
```

Notes: the `as never` cast exists because `SubscriberArgs` has more fields than the test supplies;
only `data` is read. TC-4 polls because the local event bus runs subscribers asynchronously.

## Implementation Steps

1. Confirm `enrich-order.ts` still exports `READY_FOR_BUSINESS_CENTRAL_EVENT`.
2. Create `src/utils/business-central-test-environment.ts` and its unit spec (fill in ENV-5); run
   `cd apps/backend && pnpm test:unit`.
3. Create `integration-tests/global-setup.ts`, add `globalSetup` to `jest.config.js`, and document
   `BUSINESS_CENTRAL_TEST_ENVIRONMENTS` in `.env.template`. Verify the guard fails closed: run
   `pnpm test:integration:modules` once with `BUSINESS_CENTRAL_DISCOVERY_URL` temporarily pointing
   at a non-allowed environment name (e.g. `.../<tenant>/NotAllowed/api/v2.0`, exported in the
   shell, not written to `.env`) and confirm the run aborts before any suite with the refusal
   message; then run it normally.
4. Narrow the TC-4 assertion in `enrich-order-event-chain.spec.ts` exactly as shown.
5. Create `src/subscribers/business-central-order-ready.ts` exactly as shown.
6. Create `bc-order-ready-subscriber.spec.ts` exactly as shown (fill in TC-2).
7. Run the new suite, then `order-ingestion/enrich-order-event-chain.spec.ts`,
   `orderapi/orders.spec.ts`, `customers/company-sync.spec.ts`, `companies/companies.spec.ts`
   individually, then `pnpm test:integration:http` and `pnpm test:integration:modules`. Report the
   pre-existing failures recorded by NIMBUS-149; do not fix them.
8. Run `pnpm build` and `pnpm lint` from the repo root.
