# Task 01: Backend — merge posted return receipts into `listReturns` — Implementation Plan

**Status:** DONE
**App:** backend
**App Root:** apps/backend
**Task ID:** 01
**Date:** 2026-09-30
**Branch:** feature/NIMBUS-172 (from develop)
**Depends on:** None

---

## Approved Decisions (user, 2026-09-30)

The user approved the plan on 2026-09-30, with OQ-1..OQ-4 accepted as recommended. See PLAN.md
"Resolved Questions".

- **OQ-1 (resolved):** receipts are grouped into one processed row per non-empty
  `Return_Order_No`. Only receipts with an empty `Return_Order_No` become stand-alone rows.
  This narrows the approved SCOPE.md wording ("empty or does not match"), and the user approved
  the change. This task implements it in `buildReturnListRows`.
- **OQ-2 (resolved):** `state` (`open` | `processed`) replaces the `status` query param.
- **OQ-4 (resolved):** the processed item count is the number of distinct item + variant with a
  received quantity greater than 0 (`countReceiptItems`).

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `cd apps/backend && pnpm build` (or `pnpm build` from the repo root)
- **Lint command:** `pnpm lint` (from the repo root)
- **Test commands:**
  - Module tests: `cd apps/backend && pnpm test:integration:modules`. This matches
    `**/src/modules/*/__tests__/**/*.[jt]s`.
  - Unit tests: `cd apps/backend && pnpm test:unit`. This matches
    `**/src/**/__tests__/**/*.unit.spec.[jt]s`.
- **Test framework:** Jest with `@swc/jest`. There is no type check during tests, so run
  `pnpm build` as well.
- **Test location:** `apps/backend/src/modules/business-central/__tests__/`, plus
  `apps/backend/src/api/store/bc-returns/__tests__/`.
- **Known baseline:** one pre-existing `listOrders` guardrail test in `service.spec.ts` fails.
  It is reported twice, because the `.medusa/server` copy also runs. Do not try to fix it.
- **Conventions:**
  - Backend TypeScript uses double quotes and semicolons.
  - Module-local helpers are plain `function`s.
  - Every BC query is filtered by the customer number that the route resolves from the session.
- **Do not touch:**
  - NIMBUS-138 code (`createReturnFromSalesOrder`, `listReturnReasons`, any `TEMP (NIMBUS-138)`
    code);
  - `listOrders`/`getOrder`;
  - `getReturn`, which Task 02 owns.

## Solution Design

Today `listReturns` pages the v2.0 `salesReturnOrders` directly in BC. After this task it
returns **one combined list** built from two sources:

1. **Open return orders:** v2.0 `salesReturnOrders`, filtered by `sellToCustomerNumber`.
2. **Posted return receipts:** the ODataV4 web service `PostedReturnReceipt`, filtered by
   `Sell_to_Customer_No`.
   - The URL comes from the existing private `getODataV4Url` (NIMBUS-138). That call adds the
     `company='<name>'` parameter and costs one company-name request.
   - It requests `$select=No,Return_Order_No,External_Document_No,Document_Date` only. That
     leaves out names, addresses, phone and e-mail.

The two sources are merged by the pure functions in a new file `return-history.ts`:

- **Open row:** each open return order becomes one row with `state: "open"`. Posted receipts
  whose `Return_Order_No` equals its number are grouped under it. A partly received order
  stays open.
- **Processed return order row:** receipts whose non-empty `Return_Order_No` matches no open
  return order are grouped into **one row per return order number**, with `state: "processed"`
  and `source: "return_order"`. BC deletes a return order once it is fully processed, so this
  is the normal processed case.
- **Stand-alone receipt row:** each receipt with an **empty** `Return_Order_No` becomes its own
  row, with `state: "processed"` and `source: "posted_receipt"`, identified by the receipt
  number.
- **Sort order:** latest activity first.
  - An open row sorts by the return order `documentDate`.
  - A processed row sorts by the latest `Document_Date` of its receipts. That date is stored in
    the row's `documentDate`.
  - Ties are broken by number, descending.
- **Filters and paging:** `state`, `date_from`/`date_to` (on the row's `documentDate`) and
  `search` are applied in memory. `search` is a case-insensitive "contains" on the row number
  or on any receipt number. Paging uses `offset`/`limit` in memory, and `count` is the exact
  filtered row count.
- **Item count for processed rows:** it is calculated from the receipt lines, which are read
  only for the processed rows **on the returned page**.
  - The data comes from the ODataV4 web service `PostedReturnReceiptReturnRcptLines`, with
    `$select=Document_No,Type,No,Variant_Code,Quantity`.
  - Receipt numbers are sent 20 at a time, as `Document_No eq 'a' or Document_No eq 'b'`.
  - The count is the number of distinct item number + variant on `Item` lines with
    quantity > 0.
  - Open rows keep today's count (the `Item` lines of the return order).

**Why in memory?** BC cannot page across two entity sets. Both sources are read up to a cap:
1000 open return orders and 5000 receipt headers. When a cap is reached, a `logger.warn` is
written. Both reads are small: the test customer has 41 receipts and the tenant has 7 open
return orders. This is an accepted trade-off, and PLAN.md records it.

**Security:**
- The customer number still comes only from the route (the session).
- Receipt lines are filtered by `Document_No` only, but the numbers come from headers that were
  already filtered by the customer, so no other company's lines can be requested.

**API change:**
- The query param `status` (BC status `Open`/`Released`) is **replaced** by
  `state: "open" | "processed"`, as the approved scope asks (all / open / processed filter).
- The only consumer is the storefront, which Task 03 updates.
- The raw BC `status` is still returned on open rows and is `""` on processed rows.

**Round trips per list call:**
- 1 token request;
- the open return orders, in parallel with the company name followed by the receipt headers;
- 0 to n receipt-line requests, one per 20 processed receipts on the page.

## Code Skeletons

### Edit 1: `apps/backend/src/modules/business-central/types.ts`

Replace the block from `export type BCListReturnsParams = {` up to the end of
`export type BCReturnListItem = { ... };` (currently lines 135–151) with the following:

```typescript
export type BCReturnState = "open" | "processed";

// "return_order": the row is a BC return order (open, or processed = only posted receipts left).
// "posted_receipt": a posted return receipt without a return order, identified by its own number.
export type BCReturnSource = "return_order" | "posted_receipt";

export type BCPostedReturnReceiptSummary = {
  number: string;
  // Document_Date of the posted receipt; "" when BC sends no date.
  receivedDate: string;
  // Free text (e.g. "AX 209475" or the portal "RET-..." request id). Display-only "External ref".
  externalDocumentNumber: string;
};

export type BCListReturnsParams = {
  customerNumber: string;
  limit: number;
  offset: number;
  state?: BCReturnState;
  date_from?: string;
  date_to?: string;
  search?: string;
};

export type BCReturnListItem = {
  id: string;
  number: string;
  // Open: the return order's document date. Processed: the latest receipt Document_Date.
  documentDate: string;
  // Decoded BC status for open return orders; "" for processed rows.
  status: string;
  state: BCReturnState;
  source: BCReturnSource;
  itemCount: number;
  // Oldest first. Empty for open return orders without posted receipts.
  receipts: BCPostedReturnReceiptSummary[];
};
```

Leave `BCListReturnsResult` and everything else unchanged.

### New File: `apps/backend/src/modules/business-central/return-history.ts`

This file is complete. Write it verbatim.

```typescript
import type {
  BCListReturnsParams,
  BCPostedReturnReceiptSummary,
  BCReturnListItem,
} from "./types";

// A PostedReturnReceipt header, normalized by service.ts. returnOrderNumber is "" when the
// receipt has no return order.
export type PostedReturnReceiptHeader = BCPostedReturnReceiptSummary & {
  returnOrderNumber: string;
};

// A PostedReturnReceiptReturnRcptLines row, normalized by service.ts. lineType is decoded
// ("Item", or " " for BC text lines). Fields that were not selected are "" / 0.
export type PostedReturnReceiptLineRecord = {
  documentNumber: string;
  lineNumber: number;
  lineType: string;
  itemNumber: string;
  variantCode: string;
  description: string;
  quantity: number;
  unitOfMeasureCode: string;
  returnReasonCode: string;
};

export type ReturnListFilters = Pick<
  BCListReturnsParams,
  "state" | "date_from" | "date_to" | "search"
>;

function compareReceiptsChronologically(
  left: BCPostedReturnReceiptSummary,
  right: BCPostedReturnReceiptSummary
): number {
  return (
    left.receivedDate.localeCompare(right.receivedDate) ||
    left.number.localeCompare(right.number)
  );
}

function compareByLatestActivity(left: BCReturnListItem, right: BCReturnListItem): number {
  return (
    right.documentDate.localeCompare(left.documentDate) ||
    right.number.localeCompare(left.number)
  );
}

function toReceiptSummary(header: PostedReturnReceiptHeader): BCPostedReturnReceiptSummary {
  return {
    number: header.number,
    receivedDate: header.receivedDate,
    externalDocumentNumber: header.externalDocumentNumber,
  };
}

export function latestReceivedDate(
  receipts: readonly BCPostedReturnReceiptSummary[]
): string {
  return receipts.reduce(
    (latest, receipt) => (receipt.receivedDate > latest ? receipt.receivedDate : latest),
    ""
  );
}

// Open return orders keep their row; receipts are grouped under the return order they belong
// to. Receipts of return orders that are no longer open become one processed row per return
// order number; receipts without a return order become one processed row each.
export function buildReturnListRows(
  openReturns: readonly BCReturnListItem[],
  receiptHeaders: readonly PostedReturnReceiptHeader[]
): BCReturnListItem[] {
  const receiptsByReturnOrder = new Map<string, BCPostedReturnReceiptSummary[]>();
  const standaloneReceipts: BCPostedReturnReceiptSummary[] = [];

  for (const header of receiptHeaders) {
    if (header.returnOrderNumber === "") {
      standaloneReceipts.push(toReceiptSummary(header));
      continue;
    }

    const group = receiptsByReturnOrder.get(header.returnOrderNumber) ?? [];
    group.push(toReceiptSummary(header));
    receiptsByReturnOrder.set(header.returnOrderNumber, group);
  }

  const rows: BCReturnListItem[] = [];
  const openNumbers = new Set<string>();

  for (const openReturn of openReturns) {
    openNumbers.add(openReturn.number);
    rows.push({
      ...openReturn,
      state: "open",
      source: "return_order",
      receipts: [...(receiptsByReturnOrder.get(openReturn.number) ?? [])].sort(
        compareReceiptsChronologically
      ),
    });
  }

  for (const [returnOrderNumber, receipts] of receiptsByReturnOrder) {
    if (openNumbers.has(returnOrderNumber)) {
      continue;
    }

    const sortedReceipts = [...receipts].sort(compareReceiptsChronologically);
    rows.push({
      id: `return-order:${returnOrderNumber}`,
      number: returnOrderNumber,
      documentDate: latestReceivedDate(sortedReceipts),
      status: "",
      state: "processed",
      source: "return_order",
      itemCount: 0,
      receipts: sortedReceipts,
    });
  }

  for (const receipt of standaloneReceipts) {
    rows.push({
      id: `posted-receipt:${receipt.number}`,
      number: receipt.number,
      documentDate: receipt.receivedDate,
      status: "",
      state: "processed",
      source: "posted_receipt",
      itemCount: 0,
      receipts: [receipt],
    });
  }

  return rows.sort(compareByLatestActivity);
}

export function filterReturnListRows(
  rows: readonly BCReturnListItem[],
  filters: ReturnListFilters
): BCReturnListItem[] {
  const search = filters.search?.trim().toLowerCase();

  return rows.filter((row) => {
    const activityDate = row.documentDate.slice(0, 10);

    if (filters.state && row.state !== filters.state) {
      return false;
    }
    if (filters.date_from && (activityDate === "" || activityDate < filters.date_from)) {
      return false;
    }
    if (filters.date_to && (activityDate === "" || activityDate > filters.date_to)) {
      return false;
    }
    if (
      search &&
      !row.number.toLowerCase().includes(search) &&
      !row.receipts.some((receipt) => receipt.number.toLowerCase().includes(search))
    ) {
      return false;
    }

    return true;
  });
}

// Distinct item number + variant over the received Item lines of the given receipts.
export function countReceiptItems(
  receiptNumbers: readonly string[],
  lines: readonly PostedReturnReceiptLineRecord[]
): number {
  const receiptNumberSet = new Set(receiptNumbers);
  const items = new Set<string>();

  for (const line of lines) {
    if (
      receiptNumberSet.has(line.documentNumber) &&
      line.lineType === "Item" &&
      line.quantity > 0
    ) {
      items.add(`${line.itemNumber}\u0000${line.variantCode}`);
    }
  }

  return items.size;
}
```

### Edit 2: `apps/backend/src/modules/business-central/service.ts`

**2a. Imports.** Directly below the existing `import type { ... } from "./types";` block, add
the following:

```typescript
import {
  buildReturnListRows,
  countReceiptItems,
  filterReturnListRows,
} from "./return-history";
import type {
  PostedReturnReceiptHeader,
  PostedReturnReceiptLineRecord,
} from "./return-history";
```

**2b. Constants.** Insert these lines directly **before** the existing line
`const CREATE_SALES_ORDER_TIMEOUT_MS = 30000;`:

```typescript
const OPEN_RETURN_ORDER_LIST_FIELDS = "id,number,documentDate,status";
const OPEN_RETURN_ORDER_FETCH_CAP = 1000;
const POSTED_RETURN_RECEIPT_ENTITY_SET = "PostedReturnReceipt";
const POSTED_RETURN_RECEIPT_LINES_ENTITY_SET = "PostedReturnReceiptReturnRcptLines";
// Header fields only: the web service also carries names, addresses, phone and e-mail.
const POSTED_RETURN_RECEIPT_FIELDS = "No,Return_Order_No,External_Document_No,Document_Date";
const POSTED_RETURN_RECEIPT_LIST_LINE_FIELDS = "Document_No,Type,No,Variant_Code,Quantity";
const POSTED_RETURN_RECEIPT_FETCH_CAP = 5000;
const POSTED_RETURN_RECEIPT_LINE_FILTER_CHUNK_SIZE = 20;
```

**2c. Open-row mapper.** Replace the body of the existing `mapSalesReturnOrderToListItem` with
the following. The signature is unchanged.

```typescript
function mapSalesReturnOrderToListItem(
  item: BCSalesReturnOrderRaw
): BCReturnListItem {
  return {
    id: item.id,
    number: requireBusinessCentralString(item.number, "number"),
    documentDate: item.documentDate,
    status: decodeBCEnumValue(item.status),
    state: "open",
    source: "return_order",
    itemCount: (item.salesReturnOrderLines ?? []).filter(
      (line) => line.lineType === "Item"
    ).length,
    receipts: [],
  };
}
```

**2d. Raw receipt types and mappers.** Insert them directly **before** the existing line
`type BCSalesReturnOrderDetailLineRaw = {`, which comes just after `resolveBCCurrencyCode`.

```typescript
type BCPostedReturnReceiptRaw = {
  No?: unknown;
  Return_Order_No?: unknown;
  External_Document_No?: unknown;
  Document_Date?: unknown;
};

type BCPostedReturnReceiptLineRaw = {
  Document_No?: unknown;
  Line_No?: unknown;
  Type?: unknown;
  No?: unknown;
  Variant_Code?: unknown;
  Description?: unknown;
  Quantity?: unknown;
  Unit_of_Measure_Code?: unknown;
  Return_Reason_Code?: unknown;
};

function mapPostedReturnReceiptHeader(
  raw: BCPostedReturnReceiptRaw
): PostedReturnReceiptHeader | null {
  const number = optionalString(raw.No).trim();

  if (!number) {
    return null;
  }

  return {
    number,
    returnOrderNumber: optionalString(raw.Return_Order_No).trim(),
    externalDocumentNumber: optionalString(raw.External_Document_No).trim(),
    receivedDate: optionalDate(raw.Document_Date) ?? "",
  };
}

function mapPostedReturnReceiptLine(
  raw: BCPostedReturnReceiptLineRaw
): PostedReturnReceiptLineRecord {
  return {
    documentNumber: optionalString(raw.Document_No).trim(),
    lineNumber: optionalNumber(raw.Line_No),
    lineType: decodeBCEnumValue(raw.Type),
    itemNumber: optionalString(raw.No),
    variantCode: optionalString(raw.Variant_Code),
    description: optionalString(raw.Description),
    quantity: optionalNumber(raw.Quantity),
    unitOfMeasureCode: optionalString(raw.Unit_of_Measure_Code),
    returnReasonCode: optionalString(raw.Return_Reason_Code),
  };
}

// Points an ODataV4 URL from getODataV4Url at another web service, keeping ?company=...
function withODataV4Resource(odataUrl: URL, resource: string): URL {
  const url = new URL(odataUrl.toString());
  url.pathname = url.pathname.replace(/\/ODataV4\/[^/]+$/, `/ODataV4/${resource}`);
  return url;
}
```

The existing helpers `optionalString`, `optionalNumber`, `optionalDate`, `decodeBCEnumValue`
and `escapeODataString` are module-level `function` declarations in the same file. Reuse them
and do not duplicate them.

**2e. Replace `listReturns`.** Replace the whole existing method, including its three-line
comment `// Filters directly on sellToCustomerNumber: ...`, with the following. Add the three
private helpers directly after it, in the same class.

```typescript
  // Merges open return orders (v2.0 salesReturnOrders) with posted return receipts (ODataV4
  // PostedReturnReceipt), both filtered on the session's customer number. salesReturnOrder has
  // no customerId, so no customer-GUID lookup is needed (contrast with listOrders). BC cannot
  // page across two sources, so both are read up to a cap and merged, filtered, sorted and
  // paged in memory (NIMBUS-172).
  async listReturns(params: BCListReturnsParams): Promise<BCListReturnsResult> {
    const discoveryUrl = this.getDiscoveryUrl();
    const tenantId = this.getTenantId(discoveryUrl);
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);

    const receiptsUrlPromise = this.getODataV4Url(
      discoveryUrl,
      accessToken,
      POSTED_RETURN_RECEIPT_ENTITY_SET
    );
    const [openReturns, receiptHeaders] = await Promise.all([
      this.fetchOpenReturnOrders(discoveryUrl, accessToken, params.customerNumber),
      receiptsUrlPromise.then((receiptsUrl) =>
        this.fetchPostedReturnReceiptHeaders(
          receiptsUrl,
          accessToken,
          [`Sell_to_Customer_No eq '${escapeODataString(params.customerNumber)}'`],
          POSTED_RETURN_RECEIPT_FETCH_CAP
        )
      ),
    ]);
    const receiptsUrl = await receiptsUrlPromise;

    if (
      openReturns.length >= OPEN_RETURN_ORDER_FETCH_CAP ||
      receiptHeaders.length >= POSTED_RETURN_RECEIPT_FETCH_CAP
    ) {
      this.logger?.warn(
        "Business Central return history reached its fetch cap; older returns are not listed"
      );
    }

    const rows = filterReturnListRows(buildReturnListRows(openReturns, receiptHeaders), {
      state: params.state,
      date_from: params.date_from,
      date_to: params.date_to,
      search: params.search,
    });
    const pageRows = rows.slice(params.offset, params.offset + params.limit);
    const processedReceiptNumbers = pageRows
      .filter((row) => row.state === "processed")
      .flatMap((row) => row.receipts.map((receipt) => receipt.number));
    const receiptLines =
      processedReceiptNumbers.length > 0
        ? await this.fetchPostedReturnReceiptLines(
            receiptsUrl,
            accessToken,
            processedReceiptNumbers,
            POSTED_RETURN_RECEIPT_LIST_LINE_FIELDS
          )
        : [];

    return {
      returns: pageRows.map((row) =>
        row.state === "processed"
          ? {
              ...row,
              itemCount: countReceiptItems(
                row.receipts.map((receipt) => receipt.number),
                receiptLines
              ),
            }
          : row
      ),
      count: rows.length,
      offset: params.offset,
      limit: params.limit,
    };
  }

  private async fetchOpenReturnOrders(
    discoveryUrl: URL,
    accessToken: string,
    customerNumber: string
  ): Promise<BCReturnListItem[]> {
    const odataUrl = new URL(`${discoveryUrl.toString()}/salesReturnOrders()`);
    odataUrl.searchParams.set(
      "$filter",
      `sellToCustomerNumber eq '${escapeODataString(customerNumber)}'`
    );
    odataUrl.searchParams.set("$top", String(OPEN_RETURN_ORDER_FETCH_CAP));
    odataUrl.searchParams.set("$select", OPEN_RETURN_ORDER_LIST_FIELDS);
    odataUrl.searchParams.set("$expand", "salesReturnOrderLines($select=id,lineType)");

    const returnsResponse = await fetch(odataUrl.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });

    if (!returnsResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central returns request failed with status ${returnsResponse.status}`
      );
    }

    const returnsBody = (await returnsResponse.json()) as {
      value?: BCSalesReturnOrderRaw[];
    };

    return (returnsBody.value ?? []).map(mapSalesReturnOrderToListItem);
  }

  private async fetchPostedReturnReceiptHeaders(
    receiptsUrl: URL,
    accessToken: string,
    filters: string[],
    top: number
  ): Promise<PostedReturnReceiptHeader[]> {
    const url = new URL(receiptsUrl.toString());
    url.searchParams.set("$filter", filters.join(" and "));
    url.searchParams.set("$select", POSTED_RETURN_RECEIPT_FIELDS);
    url.searchParams.set("$top", String(top));

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central posted return receipts request failed with status ${response.status}`
      );
    }

    const body = (await response.json()) as { value?: BCPostedReturnReceiptRaw[] };

    return (body.value ?? [])
      .map(mapPostedReturnReceiptHeader)
      .filter((header): header is PostedReturnReceiptHeader => header !== null);
  }

  // Lines are filtered on Document_No only; callers pass receipt numbers taken from headers
  // that were already filtered on the customer number.
  private async fetchPostedReturnReceiptLines(
    receiptsUrl: URL,
    accessToken: string,
    receiptNumbers: readonly string[],
    select: string
  ): Promise<PostedReturnReceiptLineRecord[]> {
    const uniqueNumbers = [...new Set(receiptNumbers)];
    const chunks: string[][] = [];

    for (
      let index = 0;
      index < uniqueNumbers.length;
      index += POSTED_RETURN_RECEIPT_LINE_FILTER_CHUNK_SIZE
    ) {
      chunks.push(
        uniqueNumbers.slice(index, index + POSTED_RETURN_RECEIPT_LINE_FILTER_CHUNK_SIZE)
      );
    }

    const chunkResults = await Promise.all(
      chunks.map(async (chunk) => {
        const url = withODataV4Resource(receiptsUrl, POSTED_RETURN_RECEIPT_LINES_ENTITY_SET);
        url.searchParams.set(
          "$filter",
          chunk
            .map((number) => `Document_No eq '${escapeODataString(number)}'`)
            .join(" or ")
        );
        url.searchParams.set("$select", select);

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            authorization: `Bearer ${accessToken}`,
            accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new MedusaError(
            MedusaError.Types.UNEXPECTED_STATE,
            `Business Central posted return receipt lines request failed with status ${response.status}`
          );
        }

        const body = (await response.json()) as { value?: BCPostedReturnReceiptLineRaw[] };

        return (body.value ?? []).map(mapPostedReturnReceiptLine);
      })
    );

    return chunkResults.flat();
  }
```

### Edit 3: `apps/backend/src/api/store/bc-returns/validators.ts`

Replace the line `status: z.string().optional(),` with the following:

```typescript
    state: z.enum(["open", "processed"]).optional(),
```

### Edit 4: `apps/backend/src/api/store/bc-returns/middlewares.ts`

In the `defaults` array, replace `"status",` with `"state",`. Change nothing else.

### Edit 5: `apps/backend/src/api/store/bc-returns/route.ts`

- Replace `const { limit, offset, status, date_from, date_to, search } =` with
  `const { limit, offset, state, date_from, date_to, search } =`.
- In `bcParams`, replace `status,` with `state,`.

### Test file moves

1. **Delete** the whole `describe("BusinessCentralModuleService.listReturns", ...)` block from
   `apps/backend/src/modules/business-central/__tests__/service.spec.ts` (currently lines
   878–1037, the last block in the file, together with the blank line before it).
   - Check whether any import or helper at the top of the file then becomes unused. `jsonResponse`
     is declared *inside* that describe, so nothing else should be affected.
   - Its five cases move, in rewritten form, to the new `list-returns.spec.ts` below.
2. Create the two new spec files below.

### New File: `apps/backend/src/modules/business-central/__tests__/return-history.spec.ts`

```typescript
import {
  buildReturnListRows,
  countReceiptItems,
  filterReturnListRows,
  latestReceivedDate,
} from "../return-history";
import type {
  PostedReturnReceiptHeader,
  PostedReturnReceiptLineRecord,
} from "../return-history";
import type { BCReturnListItem } from "../types";

function openReturn(overrides: Partial<BCReturnListItem> = {}): BCReturnListItem {
  return {
    id: "ro-guid-1",
    number: "31500002",
    documentDate: "2026-09-20",
    status: "Released",
    state: "open",
    source: "return_order",
    itemCount: 2,
    receipts: [],
    ...overrides,
  };
}

function receipt(
  number: string,
  returnOrderNumber: string,
  receivedDate: string,
  externalDocumentNumber = ""
): PostedReturnReceiptHeader {
  return { number, returnOrderNumber, receivedDate, externalDocumentNumber };
}

function line(overrides: Partial<PostedReturnReceiptLineRecord>): PostedReturnReceiptLineRecord {
  return {
    documentNumber: "30700005",
    lineNumber: 10000,
    lineType: "Item",
    itemNumber: "FVIE-M-BLACK",
    variantCode: "XL",
    description: "Fjeld Vest",
    quantity: 1,
    unitOfMeasureCode: "PCS",
    returnReasonCode: "NORMAL",
    ...overrides,
  };
}

describe("buildReturnListRows", () => {
  // IMPLEMENT: the TC-1..TC-5 cases from the Test Cases section below.
});

describe("filterReturnListRows", () => {
  // IMPLEMENT: TC-6..TC-8.
});

describe("countReceiptItems", () => {
  // IMPLEMENT: TC-9.
});

describe("latestReceivedDate", () => {
  // IMPLEMENT: TC-10.
});
```

### New File: `apps/backend/src/modules/business-central/__tests__/list-returns.spec.ts`

This is a URL-routed fetch mock. The service runs requests in parallel, so the tests must
**not** depend on the order of `fetch` calls. Write this scaffold verbatim, then add the cases.

```typescript
import BusinessCentralModuleService from "../service";

const originalFetch = global.fetch;
const COMPANY_ID = "00000000-0000-0000-0000-0000000000c1";

type MockReply = { body: unknown; status?: number };

type BcRoutes = {
  openReturns?: MockReply;
  receipts?: MockReply;
  lines?: MockReply;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function reply(route: MockReply | undefined): Response {
  return route ? jsonResponse(route.body, route.status) : jsonResponse({ value: [] });
}

function mockBc(routes: BcRoutes): jest.Mock {
  const fetchMock = jest.fn(async (input: string | URL) => {
    const url = new URL(String(input));

    if (url.hostname === "login.microsoftonline.com") {
      return jsonResponse({ access_token: "access-token" });
    }
    if (url.pathname.endsWith(`/companies(${COMPANY_ID})`)) {
      return jsonResponse({ name: "Nimbus Nordic A/S" });
    }
    if (url.pathname.endsWith("/salesReturnOrders()")) {
      return reply(routes.openReturns);
    }
    if (url.pathname.endsWith("/ODataV4/PostedReturnReceipt")) {
      return reply(routes.receipts);
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

// TestDK-shaped fixtures (NIMBUS-172 FEATURE.md technical notes).
const OPEN_RETURN = {
  id: "ro-guid-1",
  number: "31500002",
  documentDate: "2026-09-20",
  status: "Released",
  salesReturnOrderLines: [
    { id: "l1", lineType: "Item" },
    { id: "l2", lineType: "Item" },
    { id: "l3", lineType: "_x0020_" },
  ],
};

const RECEIPTS = [
  // Partial receipt of the still-open return order.
  { No: "30700010", Return_Order_No: "31500002", External_Document_No: "RET-3f2a9c1b", Document_Date: "2026-09-25" },
  // Two receipts of a return order that is no longer open (processed).
  { No: "30700005", Return_Order_No: "31400001", External_Document_No: "", Document_Date: "2026-08-10" },
  { No: "30700007", Return_Order_No: "31400001", External_Document_No: "", Document_Date: "2026-08-15" },
  // Receipt without a return order (stand-alone processed row).
  { No: "30700003", Return_Order_No: "", External_Document_No: "AX 209475", Document_Date: "2026-09-28" },
];

const LINES = [
  { Document_No: "30700005", Type: "Item", No: "FVIE-M-BLACK", Variant_Code: "XL", Quantity: 1 },
  { Document_No: "30700007", Type: "Item", No: "FVIE-M-BLACK", Variant_Code: "XL", Quantity: 1 },
  { Document_No: "30700007", Type: "Item", No: "F2", Variant_Code: "", Quantity: 0 },
  { Document_No: "30700007", Type: "_x0020_", No: "", Variant_Code: "", Quantity: 0 },
  { Document_No: "30700003", Type: "Item", No: "A1", Variant_Code: "", Quantity: 2 },
];

describe("BusinessCentralModuleService.listReturns", () => {
  beforeEach(() => {
    process.env.BUSINESS_CENTRAL_DISCOVERY_URL =
      "https://api.businesscentral.dynamics.com/v2.0/tenant-id/Sandbox/api/v2.0";
    process.env.BUSINESS_CENTRAL_CLIENT_ID = "00000000-0000-0000-0000-000000000001";
    process.env.BUSINESS_CENTRAL_CLIENT_SECRET = "client-secret";
    process.env.BUSINESS_CENTRAL_COMPANY_ID = COMPANY_ID;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // IMPLEMENT: TC-11..TC-21 from the Test Cases section below.
});
```

The expected merged result for TC-11, with `limit: 20, offset: 0` and the fixtures above, is
the following:

```typescript
{
  returns: [
    {
      id: "posted-receipt:30700003",
      number: "30700003",
      documentDate: "2026-09-28",
      status: "",
      state: "processed",
      source: "posted_receipt",
      itemCount: 1,
      receipts: [
        { number: "30700003", receivedDate: "2026-09-28", externalDocumentNumber: "AX 209475" },
      ],
    },
    {
      id: "ro-guid-1",
      number: "31500002",
      documentDate: "2026-09-20",
      status: "Released",
      state: "open",
      source: "return_order",
      itemCount: 2,
      receipts: [
        { number: "30700010", receivedDate: "2026-09-25", externalDocumentNumber: "RET-3f2a9c1b" },
      ],
    },
    {
      id: "return-order:31400001",
      number: "31400001",
      documentDate: "2026-08-15",
      status: "",
      state: "processed",
      source: "return_order",
      itemCount: 1,
      receipts: [
        { number: "30700005", receivedDate: "2026-08-10", externalDocumentNumber: "" },
        { number: "30700007", receivedDate: "2026-08-15", externalDocumentNumber: "" },
      ],
    },
  ],
  count: 3,
  offset: 0,
  limit: 20,
}
```

## Impacted Files

| File | Change |
|---|---|
| `apps/backend/src/modules/business-central/types.ts` | New `BCReturnState`, `BCReturnSource` and `BCPostedReturnReceiptSummary`. `BCListReturnsParams.status` is replaced by `state?: BCReturnState`. `BCReturnListItem` gets `state`, `source` and `receipts`. |
| `apps/backend/src/modules/business-central/return-history.ts` | **New.** Pure merge, filter and count helpers. |
| `apps/backend/src/modules/business-central/service.ts` | Imports; constants; `mapSalesReturnOrderToListItem`; raw receipt types and mappers; `withODataV4Resource`; `listReturns(params: BCListReturnsParams): Promise<BCListReturnsResult>` (same signature, new body); new private `fetchOpenReturnOrders`, `fetchPostedReturnReceiptHeaders` and `fetchPostedReturnReceiptLines`. |
| `apps/backend/src/api/store/bc-returns/validators.ts` | `status` → `state` enum. |
| `apps/backend/src/api/store/bc-returns/middlewares.ts` | The `"status"` default becomes `"state"`. |
| `apps/backend/src/api/store/bc-returns/route.ts` | Forwards `state` instead of `status`. |
| `apps/backend/src/modules/business-central/__tests__/service.spec.ts` | Remove the `listReturns` describe block, which moves to the new spec. |
| `apps/backend/src/modules/business-central/__tests__/return-history.spec.ts` | **New.** |
| `apps/backend/src/modules/business-central/__tests__/list-returns.spec.ts` | **New.** |
| `apps/backend/src/api/store/bc-returns/__tests__/validators.unit.spec.ts` | Add the `state` cases. |

`IBusinessCentralModuleService.listReturns` keeps its signature. `getReturn` is not touched in
this task.

## Test Cases

### `return-history.spec.ts`

#### TC-1: Groups receipts under their open return order, with no duplicate row
- **Given:**
  - `openReturn()` (31500002);
  - receipts `receipt("30700010","31500002","2026-09-25")` and
    `receipt("30700011","31500002","2026-09-22")`.
- **When:** `buildReturnListRows([openReturn()], receipts)` is called.
- **Then:**
  - exactly 1 row is returned, with `state: "open"`, `source: "return_order"` and
    `status: "Released"`;
  - its `receipts` numbers are `["30700011","30700010"]` (oldest first);
  - `documentDate` is still `"2026-09-20"`.

#### TC-2: A return order that is no longer open becomes one processed row
- **Given:** no open returns, and receipts 30700005 (2026-08-10) and 30700007 (2026-08-15),
  both on `31400001`.
- **When:** `buildReturnListRows` is called.
- **Then:** 1 row is returned:
  - `id: "return-order:31400001"`, `number: "31400001"`, `state: "processed"`,
    `source: "return_order"`, `status: ""`, `itemCount: 0`;
  - `documentDate: "2026-08-15"`;
  - 2 receipts, oldest first.

#### TC-3: A receipt without a return order becomes its own processed row
- **Given:** `receipt("30700003","","2026-09-28","AX 209475")`.
- **When:** `buildReturnListRows` is called.
- **Then:** the row is:
  - `id: "posted-receipt:30700003"`, `number: "30700003"`, `source: "posted_receipt"`,
    `state: "processed"`;
  - `receipts: [{ number: "30700003", receivedDate: "2026-09-28", externalDocumentNumber: "AX 209475" }]`.

#### TC-4: Rows are sorted by latest activity, newest first
- **Given:**
  - the open return (2026-09-20);
  - the processed return order (latest receipt 2026-08-15);
  - a stand-alone receipt (2026-09-28);
  - a stand-alone receipt with `receivedDate: ""`.
- **When:** `buildReturnListRows` is called.
- **Then:** the row numbers are in this order: stand-alone (09-28), open (09-20), processed
  (08-15), and the undated row last.

#### TC-5: The number is the tie-breaker when dates are equal
- **Given:** two stand-alone receipts, `30700001` and `30700002`, with the same date.
- **When:** `buildReturnListRows` is called.
- **Then:** `30700002` comes first.

#### TC-6: State filter
- **Given:** the rows from TC-4.
- **When:** `filterReturnListRows(rows, { state: "processed" })` is called, and then with
  `{ state: "open" }`.
- **Then:** the first call returns only processed rows. The second returns only the open row.

#### TC-7: Date range is inclusive, and undated rows are excluded when a date filter is set
- **Given:** the rows from TC-4.
- **When:** `filterReturnListRows(rows, { date_from: "2026-09-20", date_to: "2026-09-28" })` is
  called.
- **Then:** only the 09-28 and 09-20 rows are returned. The undated row is excluded.

#### TC-8: Search matches the row number or a receipt number, case-insensitively
- **Given:**
  - the processed row 31400001 with receipt 30700007;
  - a stand-alone row with the number `"R-ABC"`.
- **When:** `filterReturnListRows` is called with `{ search: "30700007" }`, and then with
  `{ search: "r-abc" }`.
- **Then:** the first call returns only 31400001. The second returns only `"R-ABC"`.

#### TC-9: The item count covers distinct received Item lines of the given receipts only
- **Given:** these lines:
  - `line({documentNumber:"30700005"})`;
  - `line({documentNumber:"30700007"})`, the same item and variant;
  - `line({documentNumber:"30700007", itemNumber:"F2", variantCode:"", quantity:0})`;
  - `line({documentNumber:"30700007", lineType:" ", itemNumber:""})`;
  - `line({documentNumber:"30700007", variantCode:"L"})`;
  - `line({documentNumber:"30799999", itemNumber:"OTHER"})`.
- **When:** `countReceiptItems(["30700005","30700007"], lines)` is called.
- **Then:** the result is `2` (FVIE-M-BLACK/XL and FVIE-M-BLACK/L).

#### TC-10: `latestReceivedDate` returns the maximum date, or `""`
- **Given:** receipts dated `"2026-08-10"`, `""` and `"2026-08-15"`, and also an empty array.
- **When:** `latestReceivedDate` is called.
- **Then:** it returns `"2026-08-15"` for the receipts and `""` for the empty array.

### `list-returns.spec.ts`

#### TC-11: Merges open return orders and posted receipts into one list, sorted
- **Given:**
  `mockBc({ openReturns: { body: { value: [OPEN_RETURN] } }, receipts: { body: { value: RECEIPTS } }, lines: { body: { value: LINES } } })`.
- **When:** `listReturns({ customerNumber: "10000", limit: 20, offset: 0 })` is called.
- **Then:** the result `toEqual`s the expected object given in the skeleton section above.

#### TC-12: Both BC sources are scoped to the session's customer and select only display fields
- **Given:** the same mock as TC-11.
- **When:** `listReturns({ customerNumber: "10000", limit: 20, offset: 0 })` is called.
- **Then:**
  - `requestsTo(fetchMock, "/salesReturnOrders()")[0].searchParams`:
    - `$filter` is `"sellToCustomerNumber eq '10000'"`;
    - `$select` is `"id,number,documentDate,status"`;
    - `$expand` is `"salesReturnOrderLines($select=id,lineType)"`.
  - `requestsTo(fetchMock, "/ODataV4/PostedReturnReceipt")[0]`:
    - the path is `https://api.businesscentral.dynamics.com/v2.0/tenant-id/Sandbox/ODataV4/PostedReturnReceipt`;
    - `searchParams.get("company")` is `"'Nimbus Nordic A/S'"`;
    - `$filter` is `"Sell_to_Customer_No eq '10000'"`;
    - `$select` is `"No,Return_Order_No,External_Document_No,Document_Date"`, and it does not
      contain `Name`, `Address`, `Phone` or `E_Mail`.

#### TC-13: Receipt lines are read only for the processed rows on the page
- **Given:** the same mock as TC-11.
- **When:** `listReturns({ customerNumber: "10000", limit: 20, offset: 0 })` is called.
- **Then:** there is exactly 1 lines request, and:
  - its `$filter` contains `"Document_No eq '30700003'"`, `"Document_No eq '30700005'"` and
    `"Document_No eq '30700007'"`, joined by `" or "`;
  - it does **not** contain `30700010` (the receipt of the open row);
  - `$select` is `"Document_No,Type,No,Variant_Code,Quantity"`;
  - `company` is `"'Nimbus Nordic A/S'"`.

#### TC-14: No lines request when the page has only open rows
- **Given:** the same mock as TC-11.
- **When:** `listReturns({ customerNumber: "10000", limit: 20, offset: 0, state: "open" })` is
  called.
- **Then:**
  - `returns` has 1 row (31500002) and `count` is 1;
  - `requestsTo(fetchMock, "/ODataV4/PostedReturnReceiptReturnRcptLines")` has length 0.

#### TC-15: Paging happens after the merge, and `count` is the filtered total
- **Given:** the same mock as TC-11.
- **When:** `listReturns({ customerNumber: "10000", limit: 1, offset: 1 })` is called.
- **Then:**
  - `returns.map(r => r.number)` is `["31500002"]`;
  - `count` is 3, `offset` is 1 and `limit` is 1;
  - no lines request is made, because the page has no processed rows.

#### TC-16: Filters by processed state, date range and receipt number
- **Given:** the same mock as TC-11.
- **When:**
  `listReturns({ customerNumber: "10000", limit: 20, offset: 0, state: "processed", date_from: "2026-08-01", date_to: "2026-08-31", search: "30700007" })`
  is called.
- **Then:** `returns.map(r => r.number)` is `["31400001"]` and `count` is 1.

#### TC-17: A posted receipts error propagates
- **Given:** `mockBc({ receipts: { body: {}, status: 500 } })`.
- **When:** `listReturns` is called.
- **Then:** it rejects with
  `"Business Central posted return receipts request failed with status 500"`.

#### TC-18: An open return orders error propagates
- **Given:** `mockBc({ openReturns: { body: {}, status: 500 } })`.
- **When:** `listReturns` is called.
- **Then:** it rejects with `"Business Central returns request failed with status 500"`.

#### TC-19: A customer with no returns gets an empty page
- **Given:** `mockBc({})`, where every source returns `{ value: [] }`.
- **When:** `listReturns({ customerNumber: "10000", limit: 20, offset: 0 })` is called.
- **Then:**
  - the result is `{ returns: [], count: 0, offset: 0, limit: 20 }`;
  - no lines request is made.

#### TC-20: XML-encoded status values are decoded, and missing lines give an item count of 0
This case replaces the old TC-5.
- **Given:** the open return
  `{ id: "return-2", number: "RET-1001", documentDate: "2026-08-02", status: "Pending_x0020_Approval" }`,
  which has no `salesReturnOrderLines`, and no receipts.
- **When:** `listReturns` is called.
- **Then:** `returns[0]` includes `status: "Pending Approval"`, `itemCount: 0`,
  `state: "open"` and `receipts: []`.

#### TC-21: Customer numbers are escaped, and line filters are chunked in groups of 20
- **Given:** 25 stand-alone receipts, `No: "R01".."R25"`, each with `Return_Order_No: ""` and
  `Document_Date: "2026-09-01"`.
- **When:** `listReturns({ customerNumber: "10'00", limit: 25, offset: 0 })` is called.
- **Then:**
  - the receipts `$filter` is `"Sell_to_Customer_No eq '10''00'"`;
  - there are exactly 2 lines requests, and their `$filter` values contain 20 and 5
    `Document_No eq` terms respectively.

### `validators.unit.spec.ts` (add these cases; keep the three existing ones)

#### TC-22: Accepts the open and processed states
- **Given:** `{ state: "open" }` and `{ state: "processed" }`.
- **When:** `StoreBCReturnsQuery.parse` is called on each.
- **Then:** the value is kept (`{ limit: 20, offset: 0, state: "open" }`).

#### TC-23: Rejects unknown states and the removed `status` param
- **Given:** `{ state: "Released" }` and `{ status: "Open" }`.
- **When:** `StoreBCReturnsQuery.parse` is called on each.
- **Then:** both throw. `.strict()` rejects `status`.

## Implementation Steps

1. Edit `types.ts` (Edit 1).
2. Create `return-history.ts`, verbatim.
3. Edit `service.ts` (2a–2e).
   - Do not change `getReturn`, `mapSalesReturnOrderToDetail` or any NIMBUS-138 code.
   - If `BCReturnListItem` is still imported and used there, that is fine.
4. Edit `validators.ts`, `middlewares.ts` and `route.ts` (Edits 3–5).
5. Remove the old `listReturns` describe block from `service.spec.ts`. Create
   `return-history.spec.ts` and `list-returns.spec.ts`, filling in TC-1..TC-21. Add TC-22 and
   TC-23 to `validators.unit.spec.ts`.
6. Run `cd apps/backend && pnpm test:integration:modules`. Everything new must pass; the known
   `listOrders` baseline failure (x2) is expected.
7. Run `cd apps/backend && pnpm test:unit`.
8. Run `cd apps/backend && pnpm build` and `pnpm lint` from the root.
   - `getReturn` does not use the new list fields, so the build must pass on its own.
   - `mapSalesReturnOrderToDetail` returns `BCReturnDetail`, which this task does not change.
9. Update this file's **Status** to DONE, and `manifest.md`.
