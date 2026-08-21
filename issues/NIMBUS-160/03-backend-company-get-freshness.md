# Task 03 — GET route freshness orchestration

**App:** backend
**Depends on:** 01 (timestamp field), 02 (workflow stamps it)
**Base branch:** `develop`

## Goal
Make `GET /store/companies/:id` ensure the company was successfully synced from Business Central
within the last 10 minutes before returning it. When the timestamp is missing or stale, run the
existing sync workflow first (driven by the **authenticated** customer id, never the caller's `:id`),
then re-read and return. A sync failure must not fail the page — return the last persisted data and
leave the timestamp unchanged so the next request retries.

## Files

### Modify: `apps/backend/src/api/store/companies/[id]/route.ts`
Only the `GET` handler changes. `POST` and `DELETE` stay as-is.

```typescript
import {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  deleteCompaniesWorkflow,
  updateCompaniesWorkflow,
} from "../../../../workflows/company/workflows/";
import { syncCompanyFromBusinessCentralWorkflow } from "../../../../workflows/company/workflows/sync-company-from-business-central";
import {
  StoreGetCompanyParamsType,
  StoreUpdateCompanyType,
} from "../validators";

const BUSINESS_CENTRAL_FRESHNESS_WINDOW_MS = 10 * 60 * 1000;

function isStale(syncedAt: Date | string | null | undefined): boolean {
  if (!syncedAt) {
    return true;
  }

  const syncedMs = new Date(syncedAt).getTime();

  return (
    Number.isNaN(syncedMs) ||
    Date.now() - syncedMs > BUSINESS_CENTRAL_FRESHNESS_WINDOW_MS
  );
}

export const GET = async (
  req: AuthenticatedMedusaRequest<StoreGetCompanyParamsType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const { id } = req.params;
  const { customer_id } = req.auth_context.app_metadata as {
    customer_id: string;
  };

  const {
    data: [existing],
  } = await query.graph(
    {
      entity: "companies",
      fields: ["id", "business_central_synced_at"],
      filters: { id },
    },
    { throwIfKeyNotFound: true }
  );

  if (customer_id && isStale(existing?.business_central_synced_at)) {
    try {
      await syncCompanyFromBusinessCentralWorkflow(req.scope).run({
        input: { customerId: customer_id },
      });
    } catch (error) {
      // A sync failure must not fail the Company page; return last-known data.
      logger.error(
        `Business Central freshness sync failed for company ${id}`
      );
    }
  }

  const { data } = await query.graph(
    {
      entity: "companies",
      fields: req.queryConfig.fields,
      filters: { id },
    },
    { throwIfKeyNotFound: true }
  );

  res.json({ company: data[0] });
};

// POST and DELETE unchanged.
```

Notes / constraints:
- **Identity:** the sync always runs against `req.auth_context.app_metadata.customer_id`; the
  workflow resolves that customer's own company. The `:id` param is used only for the freshness read
  and the response, matching the existing endpoint contract. Do not pass `:id` to the workflow.
- **Failure tolerance:** the workflow returns `status: "failed"` for expected BC errors (no throw),
  so the try/catch is a safety net for *unexpected* (non-`MedusaError`) throws — both paths fall
  through to returning the last persisted company. Do not surface a 4xx/5xx from the sync attempt on
  this route.
- **No extra BC call when fresh:** when `business_central_synced_at` is ≤10 min old, skip the
  workflow entirely so `getCustomer` is not invoked.
- Keep the response shape (`{ company }`) and `req.queryConfig.fields` selection exactly as today.
- `MedusaRequest` import may be dropped if unused after the signature change; keep it if `POST`/`DELETE`
  still reference it. Remove only imports your change makes unused.

## Test cases
Covered by Task 05 (integration). Behavioural contract:

- Fresh (≤10 min) → no `getCustomer` call; stored data returned.
- Missing timestamp → `getCustomer` called; fields + timestamp updated; refreshed data returned.
- Stale success (>10 min) → `getCustomer` called; refreshed data returned; timestamp advanced.
- Stale failure (`MedusaError`) → HTTP 200; previous fields; timestamp unchanged.

## Validation
- `pnpm --filter @b2b-starter/backend build`.
- Lint the changed route file.
