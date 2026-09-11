# Task 01: Update Business Central order types for the merge — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 01
**Date:** 2026-09-11
**Branch:** feature/nimbus-170 (from develop)
**Depends on:** None

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** N/A for this task (type-only change, no new logic to test). Run `cd apps/backend && pnpm build` to confirm the type file still compiles with its current consumers (it will show errors in `service.ts` until Tasks 02/03 land — that is expected and fine for this task; do not try to "fix" `service.ts` here).
- **Test framework:** Jest (`@swc/jest`)
- **Test location:** `apps/backend/src/modules/business-central/__tests__/`
- **Naming conventions:** kebab-case files, camelCase functions/vars, PascalCase types/interfaces (per `apps/backend/copilot-instructions.md`)

## Why this task exists

NIMBUS-170 merges Business Central `salesOrders` and `salesInvoices` into one order-history view. Two BC entity sets use **different, incompatible status enums** (`salesOrderEntityBufferStatus`: `Draft`/`In Review`/`Open`; `invoiceEntityAggregateStatus`: blank/`Draft`/`In Review`/`Open`/`Paid`/`Canceled`/`Corrective`). Today's `BCOrderStatus` union in `types.ts` doesn't cleanly match either enum. **Unifying these two enums is explicitly out of scope for this story** (see `issues/NIMBUS-170/SCOPE.md`, Open Questions). This task only widens the type so a merged record can carry either source's raw status string without lying about it, and adds one new additive field (`invoiceStatus`) that signals the *merge* state (not the raw BC status) so a future story can render partial/fully-invoiced UI cheaply. It does not change any runtime logic.

## Solution Design

1. Remove the `BCOrderStatus` closed union (it is inaccurate for a merged record and, after this change, unused — grep confirms it is referenced nowhere in `apps/backend` outside `types.ts`).
2. Widen `BCOrder.status` from `BCOrderStatus` to `string` (raw passthrough of whichever BC enum produced the record).
3. Add a new type `BCOrderInvoiceStatus = "open" | "partially_invoiced" | "fully_invoiced"` and a new required field `BCOrder.invoiceStatus: BCOrderInvoiceStatus`. This is additive — no existing consumer breaks because Tasks 02/03 populate it everywhere `BCOrder`/`BCOrderDetail` objects are constructed.
4. Rename `BCGetOrderParams.orderId: string` to `BCGetOrderParams.orderNumber: string`. **Rationale (see SCOPE.md Findings):** `salesOrder.id` and `salesInvoice.id` are unrelated GUIDs; the only reliable cross-entity-set join key is the BC order **number** (`salesOrder.number` / `salesInvoice.orderNumber`). `getOrder` can no longer look up by `id` — Task 03 implements the number-based lookup. This is a breaking rename of a type used by exactly one caller (`apps/backend/src/api/store/bc-orders/[id]/route.ts`), which Task 03 updates.
5. **New requirement (added after initial scoping, confirmed by the user):** when an order's line items are merged from one or more `salesInvoice` records (partially or fully invoiced), the detail response must also expose the **original source invoices themselves** — not just the merged lines — so a consumer can see, e.g., that a split delivery produced two separate invoices. Add a new type `BCOrderInvoiceSummary` and a new required field `BCOrderDetail.invoices: BCOrderInvoiceSummary[]`. This lives on `BCOrderDetail` only, **not** on `BCOrder` — the list endpoint (`listOrders`, Task 02) deliberately stays cheap (D8/D12) and never fetches per-row invoice breakdowns; only `getOrder` (Task 03), which already fetches the full invoice set for one order, can populate this at no extra cost. An order with no linked invoices (still fully open) gets `invoices: []`, not an omitted field.

## Impacted Files

### `apps/backend/src/modules/business-central/types.ts`

Full new file content (replace the entire file):

```typescript
export type BCOrderInvoiceStatus = "open" | "partially_invoiced" | "fully_invoiced";

export type BCOrder = {
  id: string;
  number: string;
  orderDate: string;
  customerNumber: string;
  customerName: string;
  billToAddress: string[];
  shipToAddress: string[];
  status: string;
  invoiceStatus: BCOrderInvoiceStatus;
  currencyCode: string;
  totalAmountExcludingTax: number;
  totalAmountIncludingTax: number;
};

export type BCOrderLine = {
  id: string;
  sequence: number;
  lineType: string;
  itemId?: string;
  itemNumber?: string;
  itemDisplayName?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
};

export type BCOrderInvoiceSummary = {
  id: string;
  number: string;
  invoiceDate: string;
  status: string;
  totalAmountExcludingTax: number;
  totalAmountIncludingTax: number;
};

export type BCOrderDetail = BCOrder & {
  lines: BCOrderLine[];
  invoices: BCOrderInvoiceSummary[];
};

export type BCListOrdersParams = {
  customerNumber: string;
  limit: number;
  offset: number;
  status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
};

export type BCGetOrderParams = {
  customerNumber: string;
  orderNumber: string;
};

export type BCCustomerBlockedState =
  | "not_blocked"
  | "Ship"
  | "Invoice"
  | "All";

export type BCCustomer = {
  number: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  blocked: BCCustomerBlockedState;
  creditLimit: number | null;
  taxRegistrationNumber: string;
  currencyCode: string | null;
};

export type BCListOrdersResult = {
  orders: BCOrder[];
  count: number;
  offset: number;
  limit: number;
};

export type BCReturnLineInput = {
  sourceLineNo: number;
  quantityToReturn: number;
  returnReasonCode: string;
};

export type BCCreateReturnParams = {
  requestId: string;
  sourceOrderNo: string;
  lines: BCReturnLineInput[];
};

export type BCReturnLine = {
  sourceLineNo: number;
  quantityToReturn: number;
  returnReasonCode: string;
};

export type BCReturnOrder = {
  id: string;
  number: string;
  status: string;
  requestId: string;
  sourceOrderNo: string;
  lines: BCReturnLine[];
};

export type BCReturnReason = {
  id: string;
  description: string;
};

export interface IBusinessCentralModuleService {
  getOperations(): Promise<unknown>;
  listOrders(params: BCListOrdersParams): Promise<BCListOrdersResult>;
  getOrder(params: BCGetOrderParams): Promise<BCOrderDetail | null>;
  getCustomer(customerNumber: string): Promise<BCCustomer | null>;
  createReturnFromSalesOrder(
    params: BCCreateReturnParams
  ): Promise<BCReturnOrder>;
  listReturnReasons(): Promise<BCReturnReason[]>;
}
```

Everything below `BCListOrdersParams` is unchanged from today — reproduced verbatim so the file replacement is complete and unambiguous.

## Test Cases

This is a pure type change with no behavior to unit test. Do **not** add a test file for this task. Verification is purely by compilation:

### TC-1: Type file compiles standalone
- **Given:** the new `types.ts` content above.
- **When:** running `cd apps/backend && npx tsc --noEmit -p tsconfig.json` (or the closest equivalent build check available in the repo).
- **Then:** `types.ts` itself produces no type errors. (`service.ts` **will** show errors referencing `item.orderId`/`BCOrderStatus`/etc. until Tasks 02 and 03 land — this is expected; do not modify `service.ts` in this task.)

### TC-2: No remaining references to the removed `BCOrderStatus` export
- **Given:** `BCOrderStatus` has been removed from `apps/backend/src/modules/business-central/types.ts`.
- **When:** searching the backend for `BCOrderStatus`.
- **Then:** no matches remain anywhere under `apps/backend/src/` (confirmed via `grep -r "BCOrderStatus" apps/backend/src` before starting this task — only `types.ts` itself referenced it).

## Implementation Steps

1. Open `apps/backend/src/modules/business-central/types.ts`.
2. Replace its entire contents with the "Full new file content" block above.
3. Do not touch `service.ts`, any API route, or any test file in this task — those are Tasks 02 and 03.
4. Confirm no other backend file imports `BCOrderStatus` (already verified during planning; re-verify quickly with a repo search before finishing).
5. Leave the resulting `service.ts` compile errors in place — they are expected and will be resolved by Tasks 02 and 03.
