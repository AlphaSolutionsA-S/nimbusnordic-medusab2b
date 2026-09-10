# Task 03: Business Central Sales-Order Creation (`business-central` module) — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 03
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-148-bc-order-submission (from develop)
**Depends on:** None (independent of Task 02; both edit the same two files, so run 02 first to
avoid a merge conflict in `types.ts` / `service.ts`)

---

## Project Environment

Identical to Task 02:

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root)
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:modules`
- **Test framework:** Jest (`@swc/jest`, node). No database — instantiate the service directly and
  mock `global.fetch`, like `apps/backend/src/modules/business-central/__tests__/service.spec.ts`.
- **Test location:** `apps/backend/src/modules/business-central/__tests__/*.spec.ts`
- **Quote style:** **double quotes**, 2-space indent — match `service.ts`.

## THIS IS A REAL HTTP CALL, NOT A STUB

`service.ts` already contains `createReturnFromSalesOrder`, marked
`// STUB (NIMBUS-138 task 09): replace with the real BC custom-action HTTP call.` **Do not follow
that precedent here.** NIMBUS-148's SCOPE.md is explicit: "unlike `createReturnFromSalesOrder` this
is implemented as a real HTTP call against Business Central from the start, not a stub", and the
user confirmed it directly. Returning a fabricated `bcso_stub_...` id would silently poison the
integration-state metadata that NIMBUS-158's admin widget will display as a real BC order id.

Leave `createReturnFromSalesOrder` and `listReturnReasons` exactly as they are — they are
NIMBUS-138's concern, not this story's.

## Verified Business Central facts this task is built on

Checked against `issues/NIMBUS-129/bc metadata/std odata metadata.xml`, not assumed:

- **Entity sets:** `salesOrders` (`Microsoft.NAV.salesOrder`) and `salesOrderLines`
  (`Microsoft.NAV.salesOrderLine`), both declared in the `<EntityContainer>` at the root of the
  configured discovery URL — the same root-level addressing the existing `listOrders`/`getOrder`
  methods already use.
- **`salesOrder` writable header fields relevant here:** `externalDocumentNumber`
  (`MaxLength="35"`), `orderDate` (`Edm.Date`), `requestedDeliveryDate` (`Edm.Date`),
  `customerNumber` (`Nullable="false"`, `MaxLength="20"`), `currencyCode`, `salesperson`
  (`MaxLength="20"`), `pricesIncludeTax`, `discountAmount`, `discountAppliedBeforeTax`, `email`
  (`MaxLength="80"`), `phoneNumber` (`MaxLength="30"`), and the flat address field families
  `billTo{Name,AddressLine1,AddressLine2,City,State,PostCode,Country}` and
  `shipTo{Name,Contact,AddressLine1,AddressLine2,City,State,PostCode,Country}`. `number` is
  server-assigned — do not send it. `id` is `Edm.Guid` and is the key.
- **`salesOrderLine` writable fields relevant here:** `lineType`, `itemId` (`Edm.Guid`),
  `description` (`MaxLength="100"`), `description2`, `unitOfMeasureCode` (`MaxLength="10"`),
  `quantity`, `unitPrice`, `discountAmount`, `discountPercent`, `taxCode` (`MaxLength="50"`),
  `sequence`. `documentId` is set by the parent-collection URL — do not send it.
- **`lineType` is the enum `Microsoft.NAV.invoiceLineAggLineType`, whose members are `Comment`,
  `Account`, `Item`, `Resource`, `Fixed_x0020_Asset`, `Charge`, `Allocation_x0020_Account`.** The
  wire value for an item line is the string `"Item"` — confirmed both by the enum and by this
  repo's existing `prepare-bc-return.ts`, which already filters on `line.lineType === "Item"`.
- **BC's standard OData v2.0 API does not support deep insert of `salesOrderLines` inside the
  `salesOrders` POST body.** Lines are created by POSTing to the containment collection
  `salesOrders(<guid>)/salesOrderLines`, one request per line. This is why the method below is a
  header POST followed by N line POSTs, and it is also *why partial submission is naturally
  expressible* — each line succeeds or fails on its own.

This resolves SCOPE.md's open question "exact BC sales-order-creation endpoint/payload shape (OData
resource vs. bound action vs. custom API)": **plain OData resource POSTs against the standard
API v2.0 entity sets.** No bound action and no custom API page is needed or available — the custom
`metadata masterdata.xml` API surface exposes only customers, prices, contacts, and item
availability, with zero `<Action>` and zero `<Function>` declarations.

## Solution Design

One new method, `createSalesOrder`, on `BusinessCentralModuleService`:

1. Acquire the token once (same `getDiscoveryUrl` → `getTenantId` → `getClientCredentials` →
   `requestToken` sequence every other method uses).
2. `POST ${base}/salesOrders` with the header body. A non-2xx or unparseable response **throws
   `MedusaError`** — no BC order exists, so the caller records `failed` with no BC order id
   (SCOPE.md: "do not fabricate a BC order id").
3. For each line, `POST ${base}/salesOrders(<id>)/salesOrderLines`. A per-line failure is
   **collected, not thrown**.
4. Return `{ id, number, status, acceptedLineNumbers, rejectedLines }`.

### Decision: line failures after the header exists are collected, not thrown

This is a genuine trade-off and both directions were considered, so it is recorded rather than
silently chosen:

- *Throwing* on the first rejected line would keep the method's contract simple ("it worked or it
  didn't"), **but** the BC sales-order header has already been created at that point and cannot be
  un-created by this code path. The caller would record `failed` with no BC order id, an orphan
  header would sit in BC, and NIMBUS-158's retry would create a **second** BC order — the exact
  duplicate this story is required to prevent.
- *Collecting* keeps the real BC order id available to the caller in every case where a BC order
  actually exists, so the duplicate-submission guard (Task 01's `hasBusinessCentralOrder`) is
  always armed correctly.

**Collecting wins**, because preventing a duplicate BC order is an explicit SCOPE.md requirement
and a tidy method signature is not. The consequence — that an outcome can be `failed` *and* carry a
real `bc_order_id` (when BC accepted the header but rejected every line) — is handled in Task 04
and flagged in PLAN.md as something NIMBUS-158's retry story must reckon with.

### Decision: `unitPrice` is sent to BC — flagged as a business question

The canonical contract (NIMBUS-147) deliberately keeps `unitPrice` per line, and the real EDI
samples populate it (`209,25`). Sending it makes the BC line use the price the customer's system
stated. **Not** sending it would make BC price the line from the customer's own BC price list.
These give different answers whenever the two disagree, and which is correct is a business
decision, not an engineering one. This task sends `unitPrice` (the EDI order states an agreed
price; dropping submitter-supplied data silently is worse than the alternative), and PLAN.md flags
it for confirmation. If the answer comes back "let BC price it", the change is one line: stop
setting `unitPrice` in `buildSalesOrderLineBody`.

### Not doing: field-length truncation

BC enforces `MaxLength` on several fields (`description` 100, `externalDocumentNumber` 35,
`unitOfMeasureCode` 10, `salesperson` 20). This task does **not** truncate — over-long values are
sent as-is and BC rejects them, which surfaces as a recorded line failure or a recorded submission
failure rather than as silently-corrupted data in BC. Real sample values are far inside the limits.
Flagged in PLAN.md; adding truncation would be speculative and would hide a data problem.

## Code Skeletons

### Modified File: `apps/backend/src/modules/business-central/types.ts`

**Append** these types (after Task 02's additions), then add one member to
`IBusinessCentralModuleService`:

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

export type BCCreateSalesOrderLineInput = {
  lineNumber: number;
  itemId: string;
  quantity: number;
  unitPrice?: number;
  description?: string;
  unitOfMeasureCode?: string;
  discountPercent?: number;
  discountAmount?: number;
  taxCode?: string;
};

export type BCCreateSalesOrderParams = {
  customerNumber: string;
  externalDocumentNumber?: string;
  orderDate?: string;
  requestedDeliveryDate?: string;
  currencyCode?: string;
  salesperson?: string;
  pricesIncludeTax?: boolean;
  discountAmount?: number;
  discountAppliedBeforeTax?: boolean;
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

Interface member to add (after `findItemsForOrderLines` from Task 02):

```typescript
  createSalesOrder(
    params: BCCreateSalesOrderParams
  ): Promise<BCCreatedSalesOrder>;
```

### Modified File: `apps/backend/src/modules/business-central/service.ts`

Extend the existing `import type { ... } from "./types";` block with `BCCreatedSalesOrder`,
`BCCreateSalesOrderLineInput`, `BCCreateSalesOrderParams`, `BCSalesOrderAddressInput`, and
`BCSalesOrderLineRejection`.

Add these module-level helpers next to `escapeODataString` / `formatAddress`:

```typescript
type BCJsonBody = Record<string, string | number | boolean>;

function assignIfDefined(
  body: BCJsonBody,
  key: string,
  value: string | number | boolean | undefined
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
  const body: BCJsonBody = { customerNumber: params.customerNumber };

  assignIfDefined(body, "externalDocumentNumber", params.externalDocumentNumber);
  assignIfDefined(body, "orderDate", params.orderDate);
  assignIfDefined(body, "requestedDeliveryDate", params.requestedDeliveryDate);
  assignIfDefined(body, "currencyCode", params.currencyCode);
  assignIfDefined(body, "salesperson", params.salesperson);
  assignIfDefined(body, "pricesIncludeTax", params.pricesIncludeTax);
  assignIfDefined(body, "discountAmount", params.discountAmount);
  assignIfDefined(
    body,
    "discountAppliedBeforeTax",
    params.discountAppliedBeforeTax
  );
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

  assignIfDefined(body, "unitPrice", line.unitPrice);
  assignIfDefined(body, "description", line.description);
  assignIfDefined(body, "unitOfMeasureCode", line.unitOfMeasureCode);
  assignIfDefined(body, "discountPercent", line.discountPercent);
  assignIfDefined(body, "discountAmount", line.discountAmount);
  assignIfDefined(body, "taxCode", line.taxCode);

  return body;
}
```

Add these two methods to the class, immediately **before** `createReturnFromSalesOrder` (keeping
the write-oriented methods together):

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
      });
    } catch {
      return {
        lineNumber: line.lineNumber,
        message: "Business Central sales order line request failed",
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
      });
    } catch {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Business Central sales order request failed"
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
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Malformed Business Central sales order response"
      );
    }

    const salesOrderId = requireBusinessCentralString(created.id, "salesOrder.id");
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

- `requireBusinessCentralString`, `optionalString`, and `MedusaError` are already available in
  `service.ts` — reuse them.
- The line loop is sequential on purpose. BC serialises writes against one document anyway, and a
  `Promise.all` would make the accepted/rejected ordering nondeterministic.
- The `salesOrders(<guid>)` key predicate takes the raw GUID with **no quotes** — matching the
  existing `getOrder` filter (`id eq ${escapeODataString(params.orderId)}`), where BC GUID keys are
  likewise unquoted.
- No `If-Match` / ETag header is needed: BC requires those for `PATCH`/`DELETE`, not `POST`.
- `assignIfDefined` is what keeps optional fields out of the JSON body entirely rather than sending
  `null` — BC treats an explicit `null` differently from an absent field for several of these.

## Impacted Files

| File | Change | Signature |
|---|---|---|
| `apps/backend/src/modules/business-central/types.ts` | Append 5 new exported types; add 1 member to `IBusinessCentralModuleService` | `createSalesOrder(params: BCCreateSalesOrderParams): Promise<BCCreatedSalesOrder>` |
| `apps/backend/src/modules/business-central/service.ts` | Extend the `import type` block; add `BCJsonBody`, `assignIfDefined`, `assignAddress`, `buildSalesOrderHeaderBody`, `buildSalesOrderLineBody` at module level; add 2 class methods | `private async postSalesOrderLine(discoveryUrl: URL, accessToken: string, salesOrderId: string, line: BCCreateSalesOrderLineInput): Promise<BCSalesOrderLineRejection \| null>` and `async createSalesOrder(params: BCCreateSalesOrderParams): Promise<BCCreatedSalesOrder>` |

## Test Cases

### TC-1: creates the header then one line per input line (happy path)
- **Given:** BC returns `201` with `{ id, number, status }` for the header POST and `201` for both
  line POSTs
- **When:** `createSalesOrder` is called with a two-line order
- **Then:** the result carries the BC `id`/`number`/`status`, `acceptedLineNumbers` is `[1, 2]`,
  `rejectedLines` is empty, and exactly three non-token requests were made — the first to
  `/salesOrders`, the next two to `/salesOrders(<id>)/salesOrderLines`

### TC-2: maps canonical header fields onto BC's flat field names
- **Given:** a call carrying `externalDocumentNumber`, `orderDate`, `currencyCode`,
  `pricesIncludeTax`, and a `shipTo` address with a `contact`
- **When:** `createSalesOrder` is called
- **Then:** the header POST body contains `customerNumber`, `externalDocumentNumber`, `orderDate`,
  `currencyCode`, `pricesIncludeTax`, `shipToName`, `shipToContact`, `shipToAddressLine1`,
  `shipToCity`, `shipToPostCode`, `shipToCountry` — and does **not** contain a `number`, `id`,
  `lines`, or `salesOrderLines` key

### TC-3: sends `lineType: "Item"` and the resolved `itemId` on each line
- **Given:** a one-line order whose line has an `itemId`, `quantity`, `unitPrice`, `description`,
  and `unitOfMeasureCode`
- **When:** `createSalesOrder` is called
- **Then:** the line POST body is exactly
  `{ lineType: "Item", itemId, quantity, unitPrice, description, unitOfMeasureCode }` — with no
  `documentId` and no `sequence`

### TC-4: omits absent optional fields instead of sending nulls (edge case)
- **Given:** a call with no `orderDate`, no `billTo`, no `shipTo`, and a line with no `unitPrice`
- **When:** `createSalesOrder` is called
- **Then:** neither body contains an `orderDate`, `billToName`, `shipToName`, or `unitPrice` key at
  all — `Object.keys` on the parsed bodies proves absence, not `null`

### TC-5: a rejected line is collected, not thrown, and the BC order id is still returned
- **Given:** the header POST succeeds, line 1's POST returns `201`, line 2's returns `400`
- **When:** `createSalesOrder` is called
- **Then:** it resolves (does not reject) with `acceptedLineNumbers: [1]` and one entry in
  `rejectedLines` for line 2, and the real BC `id` is present

### TC-6: every line rejected still returns the real BC order id (edge case)
- **Given:** the header POST succeeds and every line POST returns `400`
- **When:** `createSalesOrder` is called
- **Then:** it resolves with an empty `acceptedLineNumbers`, a rejection per line, and a non-empty
  `id` — this is the case Task 04 records as `failed` *with* a `bc_order_id`

### TC-7: a failing header POST throws and no line request is attempted (edge case)
- **Given:** the header POST returns `422`
- **When:** `createSalesOrder` is called with a two-line order
- **Then:** it rejects with `Business Central sales order request failed with status 422` and
  exactly one non-token request was made

### TC-8: a header response without an `id` throws rather than returning a blank id (edge case)
- **Given:** the header POST returns `201` with `{ number: "SO-1", status: "Draft" }` and no `id`
- **When:** `createSalesOrder` is called
- **Then:** it rejects with a message mentioning `salesOrder.id`

### TC-9: guards its own inputs before touching the network (edge case)
- **Given:** a call with an empty `lines` array, and separately a call with an empty
  `customerNumber`
- **When:** `createSalesOrder` is called
- **Then:** each rejects with the corresponding `INVALID_DATA` message and `global.fetch` was
  never called

### TC-10: one token serves the header and every line (integration/wiring)
- **Given:** a three-line order where every request succeeds
- **When:** `createSalesOrder` is called once
- **Then:** the Azure AD token endpoint was called exactly once, and every BC request carried
  `authorization: Bearer access-token`

### New File: `apps/backend/src/modules/business-central/__tests__/sales-order-create.spec.ts`

```typescript
import BusinessCentralModuleService from "../service";
import type { BCCreateSalesOrderParams } from "../types";

const originalFetch = global.fetch;

const TOKEN_URL = "https://login.microsoftonline.com";
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
  currencyCode: "DKK",
  pricesIncludeTax: false,
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
      unitPrice: 209.25,
      description: "Telluride Jacket, Unisex, Navy - S",
      unitOfMeasureCode: "PCS",
    },
    {
      lineNumber: 2,
      itemId: "33333333-3333-3333-3333-333333333333",
      quantity: 10,
      unitPrice: 209.25,
      description: "Telluride Jacket, Unisex, Navy - M",
      unitOfMeasureCode: "PCS",
    },
  ],
};

describe("BusinessCentralModuleService.createSalesOrder", () => {
  beforeEach(() => {
    process.env.BUSINESS_CENTRAL_DISCOVERY_URL =
      "https://api.businesscentral.dynamics.com/v2.0/tenant-id/Sandbox/api/v2.0";
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
    expect(requests[0].url).toEqual(
      "https://api.businesscentral.dynamics.com/v2.0/tenant-id/Sandbox/api/v2.0/salesOrders"
    );
    expect(requests[1].url).toEqual(
      `https://api.businesscentral.dynamics.com/v2.0/tenant-id/Sandbox/api/v2.0/salesOrders(${SALES_ORDER_ID})/salesOrderLines`
    );
    expect(requests[2].url).toEqual(requests[1].url);
  });

  it("TC-2: maps canonical header fields onto BC's flat field names", async () => {
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
      currencyCode: "DKK",
      pricesIncludeTax: false,
      shipToName: "JK Tryk",
      shipToContact: "3. Parts Nimbus",
      shipToAddressLine1: "Industrikrogen 11B",
      shipToCity: "Rønnede",
      shipToPostCode: "4683",
      shipToCountry: "DK",
    });
    expect(Object.keys(header)).not.toContain("number");
    expect(Object.keys(header)).not.toContain("id");
    expect(Object.keys(header)).not.toContain("lines");
    expect(Object.keys(header)).not.toContain("salesOrderLines");
  });

  it("TC-3: sends lineType Item plus the resolved itemId on each line", async () => {
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
      unitPrice: 209.25,
      description: "Telluride Jacket, Unisex, Navy - S",
      unitOfMeasureCode: "PCS",
    });
  });

  it("TC-4: omits absent optional fields rather than sending nulls", async () => {
    // IMPLEMENT: call createSalesOrder with only customerNumber and a single line carrying just
    // { lineNumber: 1, itemId, quantity: 1 }. Assert the header body's keys are exactly
    // ["customerNumber"] and the line body's keys are exactly
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
        message:
          "Business Central rejected the sales order line with status 400",
      },
    ]);
    expect(bcRequests(fetchMock)).toHaveLength(3);
  });

  it("TC-6: returns the BC order id even when every line is rejected", async () => {
    // IMPLEMENT: mock the header plus two 400 line responses; assert acceptedLineNumbers is [],
    // rejectedLines has both line numbers, and id equals SALES_ORDER_ID.
  });

  it("TC-7: throws on a failing header post and attempts no line request", async () => {
    const fetchMock = mockBusinessCentral([headerResponse({}, 422)]);
    const service = new BusinessCentralModuleService();

    await expect(service.createSalesOrder(twoLineOrder)).rejects.toThrow(
      "Business Central sales order request failed with status 422"
    );
    expect(bcRequests(fetchMock)).toHaveLength(1);
  });

  it("TC-8: throws when the created sales order carries no id", async () => {
    mockBusinessCentral([headerResponse({ number: "SO-1", status: "Draft" })]);
    const service = new BusinessCentralModuleService();

    await expect(service.createSalesOrder(twoLineOrder)).rejects.toThrow(
      "salesOrder.id"
    );
  });

  it("TC-9: rejects an empty line list or a blank customer number without any request", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const service = new BusinessCentralModuleService();

    await expect(
      service.createSalesOrder({ ...twoLineOrder, lines: [] })
    ).rejects.toThrow("at least one line");
    await expect(
      service.createSalesOrder({ ...twoLineOrder, customerNumber: "" })
    ).rejects.toThrow("customer number");
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
});
```

Run with: `cd apps/backend && pnpm test:integration:modules`.

## Implementation Steps

1. Append the five new types to `apps/backend/src/modules/business-central/types.ts` and add the
   `createSalesOrder` member to `IBusinessCentralModuleService`.
2. Extend the `import type` block in `service.ts` with the five new type names.
3. Add `BCJsonBody`, `assignIfDefined`, `assignAddress`, `buildSalesOrderHeaderBody`, and
   `buildSalesOrderLineBody` at module level in `service.ts`.
4. Add `postSalesOrderLine` and `createSalesOrder` to the class, immediately before
   `createReturnFromSalesOrder`. **Do not modify `createReturnFromSalesOrder` or
   `listReturnReasons`.**
5. Create `apps/backend/src/modules/business-central/__tests__/sales-order-create.spec.ts` exactly
   as shown, filling in the two `// IMPLEMENT:` blocks (TC-4 and TC-6).
6. Run `cd apps/backend && pnpm test:integration:modules` and confirm all ten new test cases pass
   alongside Task 02's and the two pre-existing BC module specs.
7. Run `pnpm build` from the repo root and fix any type errors before marking this task done.
