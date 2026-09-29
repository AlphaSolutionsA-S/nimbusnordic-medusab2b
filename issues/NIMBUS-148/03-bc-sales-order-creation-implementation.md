# Task 03: Business Central Sales-Order Creation (`business-central` module) — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 03
**Date:** 2026-09-29 (revised; supersedes the 2026-09-02 version)
**Branch:** feature/NIMBUS-148 (from develop)
**Depends on:** Task 02 (logically independent, but both edit `types.ts` / `service.ts` — run 02
first, never in parallel)

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root)
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:modules`
- **Test framework:** Jest (`@swc/jest`, node). No database — instantiate the service directly and
  mock `global.fetch`, like `apps/backend/src/modules/business-central/__tests__/service.spec.ts`.
- **Test location:** `apps/backend/src/modules/business-central/__tests__/*.spec.ts`
- **Quote style:** **double quotes**, 2-space indent — match `service.ts`.

## What changed since the 2026-09-02 plan (read first)

1. **`unitPrice` is NOT sent to Business Central.** User decision recorded in
   `issues/NIMBUS-129/PROGRESS.md` (2026-09-16), repeated as binding guidance in
   `issues/NIMBUS-129/02-canonical-order-contract-implementation.md`:
   > "a submitted `unitPrice` is a *stated expectation, not an instruction*. It must **not** be set
   > explicitly on the BC sales-order line — let BC price the line exactly as it does for a manually
   > keyed order. Setting it explicitly overrides BC's contract price, so a stale price in a
   > customer's ordering system would silently beat the negotiated one. Use the submitted value only
   > to detect and flag a discrepancy."

   The line input type therefore has **no `unitPrice` field at all**, so a price cannot be sent by
   accident. By the same reasoning (BC owns pricing, tax and item master data), this revision also
   stops sending line `discountPercent` / `discountAmount` / `taxCode` / `description` and header
   `pricesIncludeTax` / `discountAmount` / `discountAppliedBeforeTax` / `salesperson` (user
   decision 2026-09-29, PLAN.md Decision 6).
   **`currencyCode` is an optional override** (user decision 2026-09-29, PLAN.md Decision 15):
   Task 04 passes it only when the order's currency differs from the BC customer's own currency.
   This method sends it when given and omits it otherwise.
2. **Line `shipmentDate` is sent** from the canonical `requestedShipmentDate` (a submitter-owned
   "when" fact per the same decision). BC `salesOrderLine.shipmentDate` is `Edm.Date`.
3. **Dates arrive already converted.** Task 04 converts canonical `DD-MM-YYYY` to `YYYY-MM-DD`
   (Task 01's `canonicalDateToBcDate`) before calling this method. This method sends what it is
   given.
4. **Ambiguous outcomes reuse the existing `BusinessCentralAmbiguousOutcomeError`.** NIMBUS-138 added
   this class to `service.ts` for the same problem on return creation: when a write request times
   out, returns 5xx/408, or returns 2xx without a usable id, BC may or may not have created the
   document. Recording that as a plain failure would invite a duplicate on retry. Task 04 records it
   as `bc_submission_outcome_unknown` (user decision 2026-09-29). `idempotencyKey` is the
   `externalDocumentNumber`, which NIMBUS-158 can use to look the order up in BC before any retry.
5. `createReturnFromSalesOrder` is **no longer a stub** (NIMBUS-138 made it real). The old "do not
   follow the stub precedent" note is obsolete; this method is a real HTTP call, and
   `createReturnFromSalesOrder` / `listReturnReasons` stay untouched.

## Verified Business Central facts this task is built on

Checked against `issues/NIMBUS-129/bc metadata/std odata metadata.xml`:

- **Entity sets:** `salesOrders` and `salesOrderLines`, at the root of the configured discovery URL
  (the same root-level addressing `listOrders` / `getOrder` use: `${base}/salesOrders()`).
- **`salesOrder` fields sent:** `customerNumber` (`Nullable="false"`, `MaxLength="20"`),
  `externalDocumentNumber` (`MaxLength="35"`), `orderDate` / `requestedDeliveryDate` (`Edm.Date`),
  `currencyCode` (only when Task 04 passes an override), `email`, `phoneNumber`, `billTo{Name,AddressLine1,AddressLine2,City,State,PostCode,Country}`,
  `shipTo{Name,Contact,AddressLine1,AddressLine2,City,State,PostCode,Country}`. `number` and `id`
  are server-assigned.
- **`salesOrderLine` fields sent:** `lineType`, `itemId` (`Edm.Guid`), `quantity`,
  `unitOfMeasureCode` (`MaxLength="10"`), `shipmentDate` (`Edm.Date`). `documentId` comes from the
  containment URL.
- **`lineType` for an item line is the string `"Item"`** (enum `invoiceLineAggLineType`).
- **No deep insert.** Lines are created by `POST salesOrders(<guid>)/salesOrderLines`, one request
  per line. That is also what makes partial submission natural.

## Solution Design

`createSalesOrder`:

1. Validate inputs (`lines` non-empty, `customerNumber` and `externalDocumentNumber` non-blank)
   before any network call.
2. Acquire the token once (`getDiscoveryUrl` → `getTenantId` → `getClientCredentials` →
   `requestToken`).
3. `POST ${base}/salesOrders` with the header body and a 30 s `AbortSignal.timeout`.
   - fetch throws (network / timeout) → `BusinessCentralAmbiguousOutcomeError`
   - status `>= 500` or `408` → `BusinessCentralAmbiguousOutcomeError`
   - any other non-2xx → `MedusaError(UNEXPECTED_STATE, "Business Central sales order request failed with status N")`
     (a definite rejection: no BC order exists)
   - 2xx but body unparseable or no string `id` → `BusinessCentralAmbiguousOutcomeError`
4. For each line, `POST ${base}/salesOrders(<id>)/salesOrderLines`. A per-line failure is
   **collected, not thrown** (PLAN.md Decision 5).
5. Return `{ id, number, status, acceptedLineNumbers, rejectedLines }`.

### Not doing: field-length truncation

Over-long values (`externalDocumentNumber` 35, `unitOfMeasureCode` 10) are sent as-is; BC rejects
them and the rejection is recorded. Real sample values are far inside the limits.

## Code Skeletons

### Modified File: `apps/backend/src/modules/business-central/types.ts`

**Append** after Task 02's additions:

```typescript
export type BCSalesOrderAddressInput = {
  name?: string;
  contact?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postCode?: string;
  country?: string;
};

// Deliberately has no unitPrice / discount / tax / description fields: Business Central prices
// and describes the line from its own master data (NIMBUS-129 PROGRESS.md, 2026-09-16).
export type BCCreateSalesOrderLineInput = {
  lineNumber: number;
  itemId: string;
  quantity: number;
  unitOfMeasureCode?: string;
  shipmentDate?: string;
};

export type BCCreateSalesOrderParams = {
  customerNumber: string;
  externalDocumentNumber: string;
  orderDate?: string;
  requestedDeliveryDate?: string;
  // Only set when the order's currency differs from the BC customer's own currency (Task 04).
  currencyCode?: string;
  email?: string;
  phoneNumber?: string;
  billTo?: BCSalesOrderAddressInput;
  shipTo?: BCSalesOrderAddressInput;
  lines: BCCreateSalesOrderLineInput[];
};

export type BCSalesOrderLineRejection = {
  lineNumber: number;
  message: string;
};

export type BCCreatedSalesOrder = {
  id: string;
  number: string;
  status: string;
  acceptedLineNumbers: number[];
  rejectedLines: BCSalesOrderLineRejection[];
};
```

Add to `IBusinessCentralModuleService`, after Task 02's `findItemsForOrderLines`:

```typescript
  createSalesOrder(
    params: BCCreateSalesOrderParams
  ): Promise<BCCreatedSalesOrder>;
```

### Modified File: `apps/backend/src/modules/business-central/service.ts`

Extend the existing `import type { ... } from "./types";` block with `BCCreatedSalesOrder`,
`BCCreateSalesOrderLineInput`, `BCCreateSalesOrderParams`, `BCSalesOrderAddressInput`, and
`BCSalesOrderLineRejection` (one import statement — do not add a second).

Add next to the existing module-level constants (after `BC_EMPTY_DATE`):

```typescript
const CREATE_SALES_ORDER_TIMEOUT_MS = 30000;
```

Add these module-level helpers next to `escapeODataString` / `formatAddress`:

```typescript
type BCJsonBody = Record<string, string | number>;

function assignIfDefined(
  body: BCJsonBody,
  key: string,
  value: string | number | undefined
): void {
  if (value !== undefined) {
    body[key] = value;
  }
}

function assignAddress(
  body: BCJsonBody,
  prefix: "billTo" | "shipTo",
  address: BCSalesOrderAddressInput | undefined
): void {
  if (!address) {
    return;
  }

  assignIfDefined(body, `${prefix}Name`, address.name);
  assignIfDefined(body, `${prefix}AddressLine1`, address.addressLine1);
  assignIfDefined(body, `${prefix}AddressLine2`, address.addressLine2);
  assignIfDefined(body, `${prefix}City`, address.city);
  assignIfDefined(body, `${prefix}State`, address.state);
  assignIfDefined(body, `${prefix}PostCode`, address.postCode);
  assignIfDefined(body, `${prefix}Country`, address.country);

  if (prefix === "shipTo") {
    assignIfDefined(body, "shipToContact", address.contact);
  }
}

function buildSalesOrderHeaderBody(
  params: BCCreateSalesOrderParams
): BCJsonBody {
  const body: BCJsonBody = {
    customerNumber: params.customerNumber,
    externalDocumentNumber: params.externalDocumentNumber,
  };

  assignIfDefined(body, "orderDate", params.orderDate);
  assignIfDefined(body, "requestedDeliveryDate", params.requestedDeliveryDate);
  assignIfDefined(body, "currencyCode", params.currencyCode);
  assignIfDefined(body, "email", params.email);
  assignIfDefined(body, "phoneNumber", params.phoneNumber);
  assignAddress(body, "billTo", params.billTo);
  assignAddress(body, "shipTo", params.shipTo);

  return body;
}

function buildSalesOrderLineBody(
  line: BCCreateSalesOrderLineInput
): BCJsonBody {
  const body: BCJsonBody = {
    lineType: "Item",
    itemId: line.itemId,
    quantity: line.quantity,
  };

  assignIfDefined(body, "unitOfMeasureCode", line.unitOfMeasureCode);
  assignIfDefined(body, "shipmentDate", line.shipmentDate);

  return body;
}
```

Add these two methods to the class, immediately **before** `createReturnFromSalesOrder`:

```typescript
  private async postSalesOrderLine(
    discoveryUrl: URL,
    accessToken: string,
    salesOrderId: string,
    line: BCCreateSalesOrderLineInput
  ): Promise<BCSalesOrderLineRejection | null> {
    const linesUrl = `${discoveryUrl.toString()}/salesOrders(${salesOrderId})/salesOrderLines`;
    let lineResponse: Response;

    try {
      lineResponse = await fetch(linesUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(buildSalesOrderLineBody(line)),
        signal: AbortSignal.timeout(CREATE_SALES_ORDER_TIMEOUT_MS),
      });
    } catch {
      return {
        lineNumber: line.lineNumber,
        message: "Business Central sales order line request did not complete",
      };
    }

    if (!lineResponse.ok) {
      return {
        lineNumber: line.lineNumber,
        message: `Business Central rejected the sales order line with status ${lineResponse.status}`,
      };
    }

    return null;
  }

  async createSalesOrder(
    params: BCCreateSalesOrderParams
  ): Promise<BCCreatedSalesOrder> {
    if (params.lines.length === 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A Business Central sales order must include at least one line."
      );
    }

    if (!params.customerNumber) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A Business Central sales order must include a customer number."
      );
    }

    if (!params.externalDocumentNumber) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A Business Central sales order must include an external document number."
      );
    }

    const discoveryUrl = this.getDiscoveryUrl();
    const tenantId = this.getTenantId(discoveryUrl);
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);
    const salesOrdersUrl = `${discoveryUrl.toString()}/salesOrders`;

    let orderResponse: Response;

    try {
      orderResponse = await fetch(salesOrdersUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(buildSalesOrderHeaderBody(params)),
        signal: AbortSignal.timeout(CREATE_SALES_ORDER_TIMEOUT_MS),
      });
    } catch {
      throw new BusinessCentralAmbiguousOutcomeError(
        "Business Central sales order request did not complete",
        params.externalDocumentNumber
      );
    }

    if (orderResponse.status >= 500 || orderResponse.status === 408) {
      throw new BusinessCentralAmbiguousOutcomeError(
        `Business Central sales order request failed with status ${orderResponse.status}`,
        params.externalDocumentNumber
      );
    }

    if (!orderResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central sales order request failed with status ${orderResponse.status}`
      );
    }

    type BCCreatedSalesOrderRaw = {
      id?: unknown;
      number?: unknown;
      status?: unknown;
    };

    let created: BCCreatedSalesOrderRaw;

    try {
      created = (await orderResponse.json()) as BCCreatedSalesOrderRaw;
    } catch {
      created = {};
    }

    // A 2xx means BC created the order, so a missing id is an unknown outcome, not a failure.
    if (typeof created.id !== "string" || created.id === "") {
      throw new BusinessCentralAmbiguousOutcomeError(
        "Business Central sales order response did not include an id",
        params.externalDocumentNumber
      );
    }

    const salesOrderId = created.id;
    const acceptedLineNumbers: number[] = [];
    const rejectedLines: BCSalesOrderLineRejection[] = [];

    for (const line of params.lines) {
      const rejection = await this.postSalesOrderLine(
        discoveryUrl,
        accessToken,
        salesOrderId,
        line
      );

      if (rejection) {
        rejectedLines.push(rejection);
        continue;
      }

      acceptedLineNumbers.push(line.lineNumber);
    }

    return {
      id: salesOrderId,
      number: optionalString(created.number),
      status: optionalString(created.status),
      acceptedLineNumbers,
      rejectedLines,
    };
  }
```

Notes for the implementer:

- `BusinessCentralAmbiguousOutcomeError`, `optionalString`, and `MedusaError` already exist in
  `service.ts` — reuse them, do not redefine them.
- The line loop is sequential on purpose (deterministic accepted/rejected ordering; BC serialises
  writes to one document anyway).
- The `salesOrders(<guid>)` key takes the raw GUID with no quotes.
- `assignIfDefined` keeps absent optionals out of the JSON body instead of sending `null`.
- Do **not** add `unitPrice` back to `buildSalesOrderLineBody` or to the line type.

## Impacted Files

| File | Change | Signature |
|---|---|---|
| `apps/backend/src/modules/business-central/types.ts` | Append 5 exported types; add 1 interface member | `createSalesOrder(params: BCCreateSalesOrderParams): Promise<BCCreatedSalesOrder>` |
| `apps/backend/src/modules/business-central/service.ts` | Extend the `import type` block; add `CREATE_SALES_ORDER_TIMEOUT_MS`, `BCJsonBody`, `assignIfDefined`, `assignAddress`, `buildSalesOrderHeaderBody`, `buildSalesOrderLineBody`; add 2 class methods | `private async postSalesOrderLine(discoveryUrl: URL, accessToken: string, salesOrderId: string, line: BCCreateSalesOrderLineInput): Promise<BCSalesOrderLineRejection \| null>`; `async createSalesOrder(params: BCCreateSalesOrderParams): Promise<BCCreatedSalesOrder>` |

## Test Cases

### TC-1: creates the header then one line per input line (happy path)
- **Given:** `201` + `{ id, number, status }` for the header, `201` for both lines
- **When:** `createSalesOrder` is called with a two-line order
- **Then:** result carries BC `id`/`number`/`status`, `acceptedLineNumbers: [1, 2]`, no
  rejections; three non-token requests — `/salesOrders`, then two to
  `/salesOrders(<id>)/salesOrderLines`

### TC-2: maps header fields onto BC's flat field names and sends no BC-owned header fields
- **Given:** a call with `externalDocumentNumber`, `orderDate`, `email`, a `shipTo` with `contact`,
  and no `currencyCode`
- **When:** `createSalesOrder` is called
- **Then:** the header body contains `customerNumber`, `externalDocumentNumber`, `orderDate`,
  `email`, `shipToName`, `shipToContact`, `shipToAddressLine1`, `shipToCity`, `shipToPostCode`,
  `shipToCountry`, and none of `number`, `id`, `lines`, `currencyCode`, `salesperson`,
  `pricesIncludeTax`, `discountAmount`

### TC-3: each line carries `lineType: "Item"`, the resolved `itemId`, and nothing BC prices
- **Given:** a line with `itemId`, `quantity`, `unitOfMeasureCode`, `shipmentDate`
- **When:** `createSalesOrder` is called
- **Then:** the line body is exactly
  `{ lineType: "Item", itemId, quantity, unitOfMeasureCode, shipmentDate }` — no `unitPrice`,
  `description`, `discountPercent`, `discountAmount`, `taxCode`, `documentId`

### TC-4: absent optional fields are omitted, not sent as nulls (edge case)
- **Given:** only `customerNumber`, `externalDocumentNumber` and one `{ lineNumber, itemId, quantity }` line
- **When:** `createSalesOrder` is called
- **Then:** header keys are exactly `["customerNumber", "externalDocumentNumber"]`; line keys are
  exactly `["lineType", "itemId", "quantity"]`

### TC-5: a rejected line is collected and the BC order id is still returned
- **Given:** header `201`, line 1 `201`, line 2 `400`
- **Then:** resolves with `acceptedLineNumbers: [1]` and one rejection for line 2

### TC-6: every line rejected still returns the real BC order id (edge case)
- **Given:** header `201`, both lines `400`
- **Then:** resolves with no accepted lines, two rejections, and the real `id`

### TC-7: a definite header rejection throws a MedusaError and attempts no line (edge case)
- **Given:** header `422`
- **Then:** rejects with `Business Central sales order request failed with status 422`; the error
  is **not** a `BusinessCentralAmbiguousOutcomeError`; one non-token request

### TC-8: a 2xx header response without an `id` is an ambiguous outcome (edge case)
- **Given:** header `201` with `{ number: "SO-1", status: "Draft" }`
- **Then:** rejects with a `BusinessCentralAmbiguousOutcomeError` whose `idempotencyKey` is the
  `externalDocumentNumber`

### TC-9: guards its inputs before touching the network (edge case)
- **Given:** empty `lines`; blank `customerNumber`; blank `externalDocumentNumber`
- **Then:** each rejects with its `INVALID_DATA` message; `fetch` never called

### TC-10: one token serves the header and every line (wiring)
- **Given:** a two-line order, every request succeeds
- **Then:** the token endpoint is called once; every BC request carries `Bearer access-token`

### TC-11: a 5xx header response is an ambiguous outcome (edge case)
- **Given:** header `503`
- **Then:** rejects with `BusinessCentralAmbiguousOutcomeError` (`idempotencyKey: "NKT004061"`)

### TC-12: a header request that never completes is an ambiguous outcome (edge case)
- **Given:** the header `fetch` rejects (network error)
- **Then:** rejects with `BusinessCentralAmbiguousOutcomeError`; no line request

### TC-13: a currency override is sent when given
- **Given:** the two-line order plus `currencyCode: "EUR"`
- **Then:** the header body contains `currencyCode: "EUR"`

### New File: `apps/backend/src/modules/business-central/__tests__/sales-order-create.spec.ts`

```typescript
import BusinessCentralModuleService, {
  BusinessCentralAmbiguousOutcomeError,
} from "../service";
import type { BCCreateSalesOrderParams } from "../types";

const originalFetch = global.fetch;

const TOKEN_URL = "https://login.microsoftonline.com";
const BASE_URL =
  "https://api.businesscentral.dynamics.com/v2.0/tenant-id/Sandbox/api/v2.0";
const SALES_ORDER_ID = "22222222-2222-2222-2222-222222222222";

function tokenResponse(): Response {
  return new Response(JSON.stringify({ access_token: "access-token" }), {
    status: 200,
  });
}

function headerResponse(
  body: Record<string, unknown> = {
    id: SALES_ORDER_ID,
    number: "SO-001234",
    status: "Draft",
  },
  status = 201
): Response {
  return new Response(JSON.stringify(body), { status });
}

function lineResponse(status = 201): Response {
  return new Response(JSON.stringify({ id: "line" }), { status });
}

function mockBusinessCentral(responses: Response[]): jest.Mock {
  const fetchMock = jest.fn();

  fetchMock.mockResolvedValueOnce(tokenResponse());

  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }

  global.fetch = fetchMock;

  return fetchMock;
}

type RecordedRequest = { url: string; body: Record<string, unknown> };

function bcRequests(fetchMock: jest.Mock): RecordedRequest[] {
  return fetchMock.mock.calls
    .filter((call) => !String(call[0]).startsWith(TOKEN_URL))
    .map((call) => ({
      url: String(call[0]),
      body: JSON.parse(String((call[1] as RequestInit).body ?? "{}")) as Record<
        string,
        unknown
      >,
    }));
}

const twoLineOrder: BCCreateSalesOrderParams = {
  customerNumber: "579000283084",
  externalDocumentNumber: "NKT004061",
  orderDate: "2026-08-26",
  email: "orders@example.com",
  shipTo: {
    name: "JK Tryk",
    contact: "3. Parts Nimbus",
    addressLine1: "Industrikrogen 11B",
    city: "Rønnede",
    postCode: "4683",
    country: "DK",
  },
  lines: [
    {
      lineNumber: 1,
      itemId: "11111111-1111-1111-1111-111111111111",
      quantity: 1,
      unitOfMeasureCode: "PCS",
      shipmentDate: "2026-09-01",
    },
    {
      lineNumber: 2,
      itemId: "33333333-3333-3333-3333-333333333333",
      quantity: 10,
    },
  ],
};

describe("BusinessCentralModuleService.createSalesOrder", () => {
  beforeEach(() => {
    process.env.BUSINESS_CENTRAL_DISCOVERY_URL = BASE_URL;
    process.env.BUSINESS_CENTRAL_CLIENT_ID =
      "00000000-0000-0000-0000-000000000001";
    process.env.BUSINESS_CENTRAL_CLIENT_SECRET = "client-secret";
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("TC-1: posts the header then one request per line", async () => {
    const fetchMock = mockBusinessCentral([
      headerResponse(),
      lineResponse(),
      lineResponse(),
    ]);
    const service = new BusinessCentralModuleService();

    await expect(service.createSalesOrder(twoLineOrder)).resolves.toEqual({
      id: SALES_ORDER_ID,
      number: "SO-001234",
      status: "Draft",
      acceptedLineNumbers: [1, 2],
      rejectedLines: [],
    });

    const requests = bcRequests(fetchMock);
    expect(requests).toHaveLength(3);
    expect(requests[0].url).toEqual(`${BASE_URL}/salesOrders`);
    expect(requests[1].url).toEqual(
      `${BASE_URL}/salesOrders(${SALES_ORDER_ID})/salesOrderLines`
    );
    expect(requests[2].url).toEqual(requests[1].url);
  });

  it("TC-2: maps header fields and sends no BC-owned header fields", async () => {
    const fetchMock = mockBusinessCentral([
      headerResponse(),
      lineResponse(),
      lineResponse(),
    ]);
    const service = new BusinessCentralModuleService();

    await service.createSalesOrder(twoLineOrder);

    const header = bcRequests(fetchMock)[0].body;
    expect(header).toMatchObject({
      customerNumber: "579000283084",
      externalDocumentNumber: "NKT004061",
      orderDate: "2026-08-26",
      email: "orders@example.com",
      shipToName: "JK Tryk",
      shipToContact: "3. Parts Nimbus",
      shipToAddressLine1: "Industrikrogen 11B",
      shipToCity: "Rønnede",
      shipToPostCode: "4683",
      shipToCountry: "DK",
    });

    for (const key of [
      "number",
      "id",
      "lines",
      "currencyCode",
      "salesperson",
      "pricesIncludeTax",
      "discountAmount",
    ]) {
      expect(Object.keys(header)).not.toContain(key);
    }
  });

  it("TC-3: sends lineType Item, the itemId, and nothing Business Central prices", async () => {
    const fetchMock = mockBusinessCentral([
      headerResponse(),
      lineResponse(),
      lineResponse(),
    ]);
    const service = new BusinessCentralModuleService();

    await service.createSalesOrder(twoLineOrder);

    expect(bcRequests(fetchMock)[1].body).toEqual({
      lineType: "Item",
      itemId: "11111111-1111-1111-1111-111111111111",
      quantity: 1,
      unitOfMeasureCode: "PCS",
      shipmentDate: "2026-09-01",
    });
  });

  it("TC-4: omits absent optional fields rather than sending nulls", async () => {
    // IMPLEMENT: call createSalesOrder with { customerNumber: "C1",
    // externalDocumentNumber: "EXT-1", lines: [{ lineNumber: 1, itemId: "item-guid", quantity: 1 }] }
    // (mock header + one line response). Assert Object.keys(header body) equals
    // ["customerNumber", "externalDocumentNumber"] and Object.keys(line body) equals
    // ["lineType", "itemId", "quantity"].
  });

  it("TC-5: collects a rejected line and still returns the BC order id", async () => {
    const fetchMock = mockBusinessCentral([
      headerResponse(),
      lineResponse(),
      lineResponse(400),
    ]);
    const service = new BusinessCentralModuleService();

    const result = await service.createSalesOrder(twoLineOrder);

    expect(result.id).toEqual(SALES_ORDER_ID);
    expect(result.acceptedLineNumbers).toEqual([1]);
    expect(result.rejectedLines).toEqual([
      {
        lineNumber: 2,
        message: "Business Central rejected the sales order line with status 400",
      },
    ]);
    expect(bcRequests(fetchMock)).toHaveLength(3);
  });

  it("TC-6: returns the BC order id even when every line is rejected", async () => {
    // IMPLEMENT: mock the header plus two 400 line responses; assert acceptedLineNumbers is [],
    // rejectedLines lists line numbers 1 and 2, and id equals SALES_ORDER_ID.
  });

  it("TC-7: throws a MedusaError on a definite header rejection and attempts no line", async () => {
    const fetchMock = mockBusinessCentral([headerResponse({}, 422)]);
    const service = new BusinessCentralModuleService();

    const error = await service.createSalesOrder(twoLineOrder).catch((e: unknown) => e);

    expect(error).not.toBeInstanceOf(BusinessCentralAmbiguousOutcomeError);
    expect((error as Error).message).toEqual(
      "Business Central sales order request failed with status 422"
    );
    expect(bcRequests(fetchMock)).toHaveLength(1);
  });

  it("TC-8: treats a created order with no id as an ambiguous outcome", async () => {
    mockBusinessCentral([headerResponse({ number: "SO-1", status: "Draft" })]);
    const service = new BusinessCentralModuleService();

    const error = await service.createSalesOrder(twoLineOrder).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BusinessCentralAmbiguousOutcomeError);
    expect((error as BusinessCentralAmbiguousOutcomeError).idempotencyKey).toEqual(
      "NKT004061"
    );
  });

  it("TC-9: rejects invalid input without any request", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const service = new BusinessCentralModuleService();

    await expect(
      service.createSalesOrder({ ...twoLineOrder, lines: [] })
    ).rejects.toThrow("at least one line");
    await expect(
      service.createSalesOrder({ ...twoLineOrder, customerNumber: "" })
    ).rejects.toThrow("customer number");
    await expect(
      service.createSalesOrder({ ...twoLineOrder, externalDocumentNumber: "" })
    ).rejects.toThrow("external document number");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("TC-10: uses a single token for the header and every line", async () => {
    const fetchMock = mockBusinessCentral([
      headerResponse(),
      lineResponse(),
      lineResponse(),
    ]);
    const service = new BusinessCentralModuleService();

    await service.createSalesOrder(twoLineOrder);

    const tokenCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).startsWith(TOKEN_URL)
    );
    expect(tokenCalls).toHaveLength(1);

    for (const call of fetchMock.mock.calls.slice(1)) {
      const headers = (call[1] as RequestInit).headers as Record<string, string>;
      expect(headers.authorization).toEqual("Bearer access-token");
    }
  });

  it("TC-11: treats a 5xx header response as an ambiguous outcome", async () => {
    // IMPLEMENT: mock headerResponse({}, 503); assert the rejection is a
    // BusinessCentralAmbiguousOutcomeError with idempotencyKey "NKT004061".
  });

  it("TC-12: treats a header request that never completes as an ambiguous outcome", async () => {
    const fetchMock = jest.fn();
    fetchMock.mockResolvedValueOnce(tokenResponse());
    fetchMock.mockRejectedValueOnce(new Error("socket hang up"));
    global.fetch = fetchMock;
    const service = new BusinessCentralModuleService();

    await expect(service.createSalesOrder(twoLineOrder)).rejects.toBeInstanceOf(
      BusinessCentralAmbiguousOutcomeError
    );
    expect(bcRequests(fetchMock)).toHaveLength(1);
  });

  it("TC-13: sends the currency override when one is given", async () => {
    const fetchMock = mockBusinessCentral([
      headerResponse(),
      lineResponse(),
      lineResponse(),
    ]);
    const service = new BusinessCentralModuleService();

    await service.createSalesOrder({ ...twoLineOrder, currencyCode: "EUR" });

    expect(bcRequests(fetchMock)[0].body.currencyCode).toEqual("EUR");
  });
});
```

Note: `bcRequests` in TC-12 parses the header request body of the rejected call — that is fine,
the body was still passed to `fetch`.

## Implementation Steps

1. Append the five types to `types.ts` and add `createSalesOrder` to `IBusinessCentralModuleService`.
2. Extend the `import type` block in `service.ts` with the five new type names.
3. Add `CREATE_SALES_ORDER_TIMEOUT_MS`, `BCJsonBody`, `assignIfDefined`, `assignAddress`,
   `buildSalesOrderHeaderBody`, `buildSalesOrderLineBody` at module level.
4. Add `postSalesOrderLine` and `createSalesOrder` immediately before `createReturnFromSalesOrder`.
   Do not modify `createReturnFromSalesOrder` or `listReturnReasons`.
5. Create `__tests__/sales-order-create.spec.ts` exactly as shown, filling in the three
   `// IMPLEMENT:` blocks (TC-4, TC-6, TC-11).
6. Run `cd apps/backend && pnpm test:integration:modules` — all thirteen new cases pass alongside
   Task 02's spec (known pre-existing `service.spec.ts` failure excepted, report it).
7. Run `pnpm build` from the repo root and fix any type errors.
