# Task 02: Backend — return detail for processed returns and posted receipts — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 02
**Date:** 2026-09-30
**Branch:** feature/NIMBUS-172 (from develop)
**Depends on:** Task 01

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from the repo root)
- **Test commands:**
  - Module tests: `cd apps/backend && pnpm test:integration:modules`.
  - Unit tests: `cd apps/backend && pnpm test:unit`.
- **Test framework:** Jest with `@swc/jest`.
- **Test location:** `apps/backend/src/modules/business-central/__tests__/get-return.spec.ts`,
  plus `apps/backend/src/api/store/bc-returns/__tests__/return-detail-route.unit.spec.ts`.
- **Known baseline:** the `listOrders` guardrail test fails (x2). This is pre-existing.
- **Conventions:** the same as Task 01.
- **Reuse from Task 01:** these are already in `service.ts`:
  - the constants `POSTED_RETURN_RECEIPT_ENTITY_SET` and `POSTED_RETURN_RECEIPT_FIELDS`;
  - the private methods `fetchPostedReturnReceiptHeaders` and `fetchPostedReturnReceiptLines`;
  - the mappers.

## Solution Design

`getReturn({ customerNumber, returnNumber })` keeps its signature, and still returns `null`
for "not yours / unknown". It now resolves three kinds of detail:

| Case | How it is found | Result |
|---|---|---|
| **Open return order**, with or without partial receipts | The Abakion `salesReturnOrders` query, unchanged (NIMBUS-141) | Today's detail, plus `state: "open"`, `source: "return_order"`, and `receipts` whose `Return_Order_No` equals the number |
| **Processed return order** (no longer open) | ODataV4 `PostedReturnReceipt` with `Sell_to_Customer_No eq c and Return_Order_No eq n` returns at least 1 row | `state: "processed"`, `source: "return_order"`, `lines: []`, `expectedCredit: null`, `status: ""`, `documentDate` = latest receipt date, all receipts with lines |
| **Stand-alone receipt** (`Return_Order_No` empty) | `PostedReturnReceipt` with `Sell_to_Customer_No eq c and No eq n`, and the row has an empty `Return_Order_No` | `state: "processed"`, `source: "posted_receipt"`, one receipt |
| Otherwise | This includes a receipt number whose receipt belongs to a return order; that receipt is shown under its return order instead | `null` → 404 |

**Request flow:**
- 1 token request;
- in parallel:
  - the Abakion return order;
  - the company name, then **both** receipt-header queries in parallel;
- then 1 receipt-lines request (up to 20 receipts per chunk), only when receipts were found.

`$select` for the lines is
`Document_No,Line_No,Type,No,Variant_Code,Description,Quantity,Unit_of_Measure_Code,Return_Reason_Code`.

**Receipt lines shown:**
- only lines with a non-blank type and a non-zero quantity;
- sorted by `Line_No`;
- mapped to `BCPostedReturnReceiptLine`, which has no prices.

BC text lines and zero-quantity lines (BC copies every order line into each partial receipt)
are dropped.

**Scoping:** every header query carries `Sell_to_Customer_No eq '<session customer>'`. Lines are
filtered only by receipt numbers that come from those scoped headers.

**`expectedCredit` becomes nullable.** A processed return has no return order left, and credit
memos are out of scope.

## Code Skeletons

### Edit 1: `apps/backend/src/modules/business-central/types.ts`

Directly **after** the `BCPostedReturnReceiptSummary` type that Task 01 added, add the
following:

```typescript
export type BCPostedReturnReceiptLine = {
  lineNumber: number;
  itemNumber: string;
  variantCode: string;
  description: string;
  quantity: number;
  unitOfMeasureCode: string;
  returnReasonCode: string;
};

export type BCPostedReturnReceipt = BCPostedReturnReceiptSummary & {
  lines: BCPostedReturnReceiptLine[];
};
```

Replace the existing `BCReturnDetail` type with the following:

```typescript
export type BCReturnDetail = {
  id: string;
  number: string;
  // Open: the return order's document date. Processed: the latest receipt Document_Date.
  documentDate: string;
  // Decoded BC status for open return orders; "" for processed returns.
  status: string;
  state: BCReturnState;
  source: BCReturnSource;
  // Return order lines; [] for processed returns (the return order no longer exists).
  lines: BCReturnDetailLine[];
  // null for processed returns: credit memos are out of scope (NIMBUS-172).
  expectedCredit: BCReturnExpectedCredit | null;
  // Posted return receipts, oldest first.
  receipts: BCPostedReturnReceipt[];
};
```

### Edit 2: `apps/backend/src/modules/business-central/return-history.ts`

Extend the type import at the top to the following:

```typescript
import type {
  BCListReturnsParams,
  BCPostedReturnReceipt,
  BCPostedReturnReceiptSummary,
  BCReturnListItem,
} from "./types";
```

Append this function at the end of the file:

```typescript
// Attaches each receipt's displayable lines: BC text lines (blank type) and zero-quantity lines
// (BC copies every return order line into each partial receipt) are dropped. Oldest receipt
// first, lines by Line_No.
export function buildPostedReturnReceipts(
  headers: readonly PostedReturnReceiptHeader[],
  lines: readonly PostedReturnReceiptLineRecord[]
): BCPostedReturnReceipt[] {
  return [...headers].sort(compareReceiptsChronologically).map((header) => ({
    ...toReceiptSummary(header),
    lines: lines
      .filter(
        (line) =>
          line.documentNumber === header.number &&
          line.lineType.trim() !== "" &&
          line.quantity !== 0
      )
      .sort((left, right) => left.lineNumber - right.lineNumber)
      .map((line) => ({
        lineNumber: line.lineNumber,
        itemNumber: line.itemNumber,
        variantCode: line.variantCode,
        description: line.description,
        quantity: line.quantity,
        unitOfMeasureCode: line.unitOfMeasureCode,
        returnReasonCode: line.returnReasonCode,
      })),
  }));
}
```

### Edit 3: `apps/backend/src/modules/business-central/service.ts`

**3a. Imports.**
- Add `BCReturnSource` to the existing `import type { ... } from "./types";` list, in
  alphabetical position near `BCReturnReason`.
- Extend the value import from `./return-history` to the following:

```typescript
import {
  buildPostedReturnReceipts,
  buildReturnListRows,
  countReceiptItems,
  filterReturnListRows,
  latestReceivedDate,
} from "./return-history";
```

**3b. Constants.** Directly after `const POSTED_RETURN_RECEIPT_LINE_FILTER_CHUNK_SIZE = 20;`,
add the following:

```typescript
const POSTED_RETURN_RECEIPT_DETAIL_LINE_FIELDS =
  "Document_No,Line_No,Type,No,Variant_Code,Description,Quantity,Unit_of_Measure_Code,Return_Reason_Code";
const MAX_RETURN_DETAIL_RECEIPTS = 100;
```

**3c. `mapSalesReturnOrderToDetail`.** In its returned object, add these three properties
directly after `status: decodeBCEnumValue(raw.status),`:

```typescript
    state: "open",
    source: "return_order",
```

Add this one directly after the closing `},` of `expectedCredit: { ... }`:

```typescript
    receipts: [],
```

**3d. Replace `getReturn`.** Replace the whole existing method, including its two-line comment,
with the following two methods:

```typescript
  // Open return orders come from the Abakion customer-portal API (unlike v2.0, its lines expose
  // variantCode and returnReasonCode). Posted return receipts come from the ODataV4
  // PostedReturnReceipt web service. Every query is filtered on the session's customer number.
  async getReturn(params: BCGetReturnParams): Promise<BCReturnDetail | null> {
    const discoveryUrl = this.getDiscoveryUrl();
    const tenantId = this.getTenantId(discoveryUrl);
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);

    const customerFilter = `Sell_to_Customer_No eq '${escapeODataString(params.customerNumber)}'`;
    const numberLiteral = `'${escapeODataString(params.returnNumber)}'`;
    const receiptsUrlPromise = this.getODataV4Url(
      discoveryUrl,
      accessToken,
      POSTED_RETURN_RECEIPT_ENTITY_SET
    );
    const [openReturn, [returnOrderReceipts, numberedReceipts]] = await Promise.all([
      this.fetchOpenReturnOrderDetail(discoveryUrl, accessToken, params),
      receiptsUrlPromise.then((receiptsUrl) =>
        Promise.all([
          this.fetchPostedReturnReceiptHeaders(
            receiptsUrl,
            accessToken,
            [customerFilter, `Return_Order_No eq ${numberLiteral}`],
            MAX_RETURN_DETAIL_RECEIPTS
          ),
          this.fetchPostedReturnReceiptHeaders(
            receiptsUrl,
            accessToken,
            [customerFilter, `No eq ${numberLiteral}`],
            1
          ),
        ])
      ),
    ]);
    const receiptsUrl = await receiptsUrlPromise;

    let source: BCReturnSource;
    let number: string;
    let receiptHeaders: PostedReturnReceiptHeader[];

    if (openReturn || returnOrderReceipts.length > 0) {
      source = "return_order";
      number =
        openReturn?.number ?? returnOrderReceipts[0]?.returnOrderNumber ?? params.returnNumber;
      receiptHeaders = returnOrderReceipts;
    } else {
      // A receipt that belongs to a return order is shown under that return order only.
      const standaloneReceipt = numberedReceipts.find(
        (receipt) => receipt.returnOrderNumber === ""
      );

      if (!standaloneReceipt) {
        return null;
      }

      source = "posted_receipt";
      number = standaloneReceipt.number;
      receiptHeaders = [standaloneReceipt];
    }

    const receiptLines =
      receiptHeaders.length > 0
        ? await this.fetchPostedReturnReceiptLines(
            receiptsUrl,
            accessToken,
            receiptHeaders.map((receipt) => receipt.number),
            POSTED_RETURN_RECEIPT_DETAIL_LINE_FIELDS
          )
        : [];
    const receipts = buildPostedReturnReceipts(receiptHeaders, receiptLines);

    if (openReturn) {
      return { ...openReturn, receipts };
    }

    return {
      id: `${source === "return_order" ? "return-order" : "posted-receipt"}:${number}`,
      number,
      documentDate: latestReceivedDate(receipts),
      status: "",
      state: "processed",
      source,
      lines: [],
      expectedCredit: null,
      receipts,
    };
  }

  private async fetchOpenReturnOrderDetail(
    discoveryUrl: URL,
    accessToken: string,
    params: BCGetReturnParams
  ): Promise<BCReturnDetail | null> {
    // IMPLEMENT: move the body of the previous getReturn here unchanged, from
    // `const returnUrl = new URL(` up to and including
    // `return raw ? mapSalesReturnOrderToDetail(raw) : null;`.
    // Keep the URL, $filter, $top=1, $select, $expand and the error message
    // "Business Central return order request failed with status ${status}" exactly as they are.
  }
```

### Edit 4: `apps/backend/src/api/store/bc-returns/[number]/route.ts`

Replace the comment
`// Foreign, unknown, processed and impossible numbers all get the same 404.` with the
following:

```typescript
  // Foreign, unknown and impossible numbers all get the same 404.
```

Change no other code. The route already returns `{ return: bcReturn }` for any non-null
result.

### Test file: `apps/backend/src/modules/business-central/__tests__/get-return.spec.ts`

Rewrite the mock setup as a URL-routed mock, because the requests now run in parallel. Keep
the existing `rawReturnOrder()` fixture and the `beforeEach`/`afterEach` blocks.

1. Replace `mockReturnResponse` with the following:

```typescript
type MockReply = { body: unknown; status?: number };

type BcRoutes = {
  returnOrder?: MockReply;
  receiptsByReturnOrder?: MockReply;
  receiptsByNumber?: MockReply;
  lines?: MockReply;
};

function reply(route: MockReply | undefined): Response {
  return route ? jsonResponse(route.body, route.status) : jsonResponse({ value: [] });
}

function mockBc(routes: BcRoutes): jest.Mock {
  const fetchMock = jest.fn(async (input: string | URL) => {
    const url = new URL(String(input));

    if (url.hostname === "login.microsoftonline.com") {
      return jsonResponse({ access_token: "access-token" });
    }
    if (url.pathname.endsWith(`/api/v2.0/companies(${COMPANY_ID})`)) {
      return jsonResponse({ name: "Nimbus Nordic A/S" });
    }
    if (url.pathname.endsWith("/salesReturnOrders")) {
      return reply(routes.returnOrder);
    }
    if (url.pathname.endsWith("/ODataV4/PostedReturnReceipt")) {
      // Check Return_Order_No first: "Return_Order_No eq" also contains "No eq".
      return (url.searchParams.get("$filter") ?? "").includes("Return_Order_No eq")
        ? reply(routes.receiptsByReturnOrder)
        : reply(routes.receiptsByNumber);
    }
    if (url.pathname.endsWith("/ODataV4/PostedReturnReceiptReturnRcptLines")) {
      return reply(routes.lines);
    }

    throw new Error(`Unexpected Business Central request: ${url.toString()}`);
  });

  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function requestsTo(fetchMock: jest.Mock, pathSuffix: string): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input)))
    .filter((url) => url.pathname.endsWith(pathSuffix));
}
```

2. Migrate the six existing cases:
   - `mockReturnResponse(body, status)` becomes
     `mockBc({ returnOrder: { body, status } })`.
   - In TC-1, add `state: "open"`, `source: "return_order"` and `receipts: []` to the expected
     object. Replace `expect(fetchMock).toHaveBeenCalledTimes(2)` with
     `expect(requestsTo(fetchMock, "/ODataV4/PostedReturnReceiptReturnRcptLines")).toHaveLength(0)`,
     because there are no receipts and therefore no lines request.
   - In TC-2, read the Abakion request with `requestsTo(fetchMock, "/salesReturnOrders")[0]`
     instead of `fetchMock.mock.calls[1][0]`. Every assertion stays the same.
   - TC-3 to TC-6 need only the mock change.

3. Add fixtures:

```typescript
const RECEIPT_HEADERS_31502910 = [
  { No: "30700012", Return_Order_No: "31502910", External_Document_No: "RET-3f2a9c1b", Document_Date: "2026-09-29" },
  { No: "30700011", Return_Order_No: "31502910", External_Document_No: "", Document_Date: "2026-09-28" },
];

const RECEIPT_LINES_31502910 = [
  { Document_No: "30700011", Line_No: 30000, Type: "Item", No: "FVIE-M-BLACK", Variant_Code: "XL", Description: "Fjeld Vest", Quantity: 1, Unit_of_Measure_Code: "PCS", Return_Reason_Code: "NORMAL" },
  { Document_No: "30700011", Line_No: 10000, Type: "_x0020_", No: "", Variant_Code: "", Description: "Fakturanr. SIN47206:", Quantity: 0, Unit_of_Measure_Code: "", Return_Reason_Code: "" },
  { Document_No: "30700011", Line_No: 60000, Type: "Item", No: "F2", Variant_Code: "", Description: "Small Freight", Quantity: 0, Unit_of_Measure_Code: "PCS", Return_Reason_Code: "NORMAL" },
  { Document_No: "30700012", Line_No: 30000, Type: "Item", No: "FVIE-M-BLACK", Variant_Code: "XL", Description: "Fjeld Vest", Quantity: 1, Unit_of_Measure_Code: "PCS", Return_Reason_Code: "DAMAGED" },
];
```

4. Add the new cases TC-7..TC-13 below.

### Test file: `apps/backend/src/api/store/bc-returns/__tests__/return-detail-route.unit.spec.ts`

Add TC-14 below. The existing `bcReturn` fixture needs the new fields, so add
`state: "open"`, `source: "return_order"` and `receipts: []`.

## Impacted Files

| File | Change |
|---|---|
| `apps/backend/src/modules/business-central/types.ts` | New `BCPostedReturnReceiptLine` and `BCPostedReturnReceipt`. `BCReturnDetail` gets `state`, `source` and `receipts`, and `expectedCredit` becomes nullable. |
| `apps/backend/src/modules/business-central/return-history.ts` | New `buildPostedReturnReceipts(headers, lines): BCPostedReturnReceipt[]`. |
| `apps/backend/src/modules/business-central/service.ts` | Imports; 2 constants; `mapSalesReturnOrderToDetail` adds 3 fields; `getReturn(params: BCGetReturnParams): Promise<BCReturnDetail \| null>` (same signature, new body); new private `fetchOpenReturnOrderDetail(discoveryUrl: URL, accessToken: string, params: BCGetReturnParams): Promise<BCReturnDetail \| null>`. |
| `apps/backend/src/api/store/bc-returns/[number]/route.ts` | Comment only. |
| `apps/backend/src/modules/business-central/__tests__/get-return.spec.ts` | Routed mock; migrated cases; TC-7..TC-13. |
| `apps/backend/src/modules/business-central/__tests__/return-history.spec.ts` | Add TC-15. |
| `apps/backend/src/api/store/bc-returns/__tests__/return-detail-route.unit.spec.ts` | Fixture fields; TC-14. |

## Test Cases

### TC-7: An open return order with partial receipts keeps its detail and lists its receipts
- **Given:**
  - `mockBc({ returnOrder: { body: { value: [rawReturnOrder()] } }, receiptsByReturnOrder: { body: { value: RECEIPT_HEADERS_31502910 } }, lines: { body: { value: RECEIPT_LINES_31502910 } } })`.
- **When:** `getReturn({ customerNumber: "10000", returnNumber: "31502910" })` is called.
- **Then:**
  - `state` is `"open"`, `source` is `"return_order"`, `status` is `"Pending Approval"`;
  - `expectedCredit` is unchanged from TC-1;
  - `receipts` is:
    ```
    [
      { number: "30700011", receivedDate: "2026-09-28", externalDocumentNumber: "",
        lines: [{ lineNumber: 30000, itemNumber: "FVIE-M-BLACK", variantCode: "XL", description: "Fjeld Vest", quantity: 1, unitOfMeasureCode: "PCS", returnReasonCode: "NORMAL" }] },
      { number: "30700012", receivedDate: "2026-09-29", externalDocumentNumber: "RET-3f2a9c1b",
        lines: [{ lineNumber: 30000, itemNumber: "FVIE-M-BLACK", variantCode: "XL", description: "Fjeld Vest", quantity: 1, unitOfMeasureCode: "PCS", returnReasonCode: "DAMAGED" }] },
    ]
    ```
    The text line and the zero-quantity F2 line are dropped.

### TC-8: A return order that is no longer open is returned as processed
- **Given:** `returnOrder` is `{ value: [] }`, with the same receipts and lines as TC-7.
- **When:** `getReturn({ customerNumber: "10000", returnNumber: "31502910" })` is called.
- **Then:** the result `toEqual`s
  `{ id: "return-order:31502910", number: "31502910", documentDate: "2026-09-29", status: "", state: "processed", source: "return_order", lines: [], expectedCredit: null, receipts: <same as TC-7> }`.

### TC-9: A stand-alone receipt is opened by its receipt number
- **Given:**
  - `returnOrder` and `receiptsByReturnOrder` are empty;
  - `receiptsByNumber` is
    `{ value: [{ No: "30700003", Return_Order_No: "", External_Document_No: "AX 209475", Document_Date: "2026-09-28" }] }`;
  - `lines` is
    `{ value: [{ Document_No: "30700003", Line_No: 10000, Type: "Item", No: "A1", Variant_Code: "", Description: "Anorak", Quantity: 2, Unit_of_Measure_Code: "PCS", Return_Reason_Code: "NORMAL" }] }`.
- **When:** `getReturn({ customerNumber: "10000", returnNumber: "30700003" })` is called.
- **Then:**
  - `id` is `"posted-receipt:30700003"`, `source` is `"posted_receipt"`, `state` is
    `"processed"`;
  - `receipts[0].externalDocumentNumber` is `"AX 209475"`;
  - `receipts[0].lines` has length 1.

### TC-10: A receipt number whose receipt belongs to a return order is not found on its own
- **Given:**
  - `returnOrder` and `receiptsByReturnOrder` are empty;
  - `receiptsByNumber` returns
    `{ No: "30700011", Return_Order_No: "31502910", External_Document_No: "", Document_Date: "2026-09-28" }`.
- **When:** `getReturn({ customerNumber: "10000", returnNumber: "30700011" })` is called.
- **Then:**
  - the result is `null`;
  - no lines request is made.

### TC-11: Every receipt query is scoped to the session's customer and selects only display fields
- **Given:** `mockBc({})`.
- **When:** `getReturn({ customerNumber: "10'00", returnNumber: "RO'1" })` is called.
- **Then:**
  - the result is `null`;
  - `requestsTo(fetchMock, "/ODataV4/PostedReturnReceipt")` has length 2, and their `$filter`
    values are, in any order:
    - `"Sell_to_Customer_No eq '10''00' and Return_Order_No eq 'RO''1'"`;
    - `"Sell_to_Customer_No eq '10''00' and No eq 'RO''1'"`;
  - both have `$select` equal to `"No,Return_Order_No,External_Document_No,Document_Date"`
    and `company` equal to `"'Nimbus Nordic A/S'"`.

### TC-12: The receipt lines request uses the detail fields and only the found receipts
- **Given:** the same mock as TC-8.
- **When:** `getReturn` is called for `31502910`.
- **Then:** there is exactly one lines request, and:
  - its `$filter` is `"Document_No eq '30700012' or Document_No eq '30700011'"`. The order is
    the BC header order, so assert with `toContain` on each term and `" or "`;
  - its `$select` is
    `"Document_No,Line_No,Type,No,Variant_Code,Description,Quantity,Unit_of_Measure_Code,Return_Reason_Code"`.

### TC-13: A posted receipts error propagates
- **Given:** `mockBc({ receiptsByReturnOrder: { body: {}, status: 500 } })`.
- **When:** `getReturn` is called.
- **Then:** it rejects with
  `"Business Central posted return receipts request failed with status 500"`.

### TC-14 (route unit test): A processed return is passed through as 200
- **Given:** `getReturn` resolves to a processed detail:
  `{ ...bcReturn, id: "return-order:31400001", number: "31400001", status: "", state: "processed", lines: [], expectedCredit: null, receipts: [] }`.
- **When:** `GET` is called with `returnNumber: "31400001"`.
- **Then:**
  - `res.status` is not called;
  - `res.json` is called with `{ return: <that object> }`.

### TC-15 (`return-history.spec.ts`): `buildPostedReturnReceipts` sorts, filters and maps
- **Given:**
  - headers for 30700012 (2026-09-29) and 30700011 (2026-09-28);
  - `line()` records with:
    - two item lines on 30700011, `lineNumber` 30000 and 20000;
    - a text line (`lineType: " "`);
    - a `quantity: 0` line;
    - a line on 30799999.
- **When:** `buildPostedReturnReceipts(headers, lines)` is called.
- **Then:**
  - the receipts are in the order 30700011, 30700012;
  - 30700011 has two lines, with `lineNumber` 20000 and 30000;
  - 30700012 has `lines: []`;
  - no line object has a `documentNumber` or `lineType` key.

## Implementation Steps

1. Edit `types.ts` (Edit 1). The build fails until Edit 3c is done. That is expected.
2. Append `buildPostedReturnReceipts` to `return-history.ts` and extend its import (Edit 2).
3. Edit `service.ts` (3a–3d). Move the old `getReturn` body into `fetchOpenReturnOrderDetail`
   verbatim.
4. Edit the route comment (Edit 4).
5. Update `get-return.spec.ts`, `return-history.spec.ts` and
   `return-detail-route.unit.spec.ts` as described.
6. Run `cd apps/backend && pnpm test:integration:modules` and `pnpm test:unit`. All new and
   migrated tests must pass; the `listOrders` baseline (x2) is expected to fail.
7. Run `cd apps/backend && pnpm build` and `pnpm lint` from the root.
8. Update this file's **Status** to DONE, and `manifest.md`.
