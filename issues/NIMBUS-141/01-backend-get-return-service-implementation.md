# Task 01: Add `getReturn` to the Business Central module service — Implementation Plan

**Status:** DONE
**App:** backend
**App Root:** apps/backend
**Task ID:** 01
**Date:** 2026-09-29
**Branch:** feature/NIMBUS-141 (from develop)
**Depends on:** NIMBUS-140 Task 01 (merged to develop). This task edits the `listReturns` mapper that NIMBUS-140 adds (Edit 3 below).

> **Blocked until NIMBUS-140 is merged to develop.** Start `feature/NIMBUS-141` from a develop
> that already contains NIMBUS-140. Check with
> `git grep -n "mapSalesReturnOrderToListItem" -- apps/backend/src/modules/business-central/service.ts`;
> it must print a match. If it does not, stop and report that NIMBUS-140 is not merged.
>
> Do **not** touch any `TEMP (NIMBUS-138)` code, or the existing `listOrders`, `getOrder`,
> `createReturnFromSalesOrder`, `listReturnReasons` and `listReturns` methods, apart from the
> one-line change in Edit 3.

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:modules` (matches `**/src/modules/*/__tests__/**/*.[jt]s`)
- **Test framework:** Jest (`@swc/jest`, node environment)
- **Test location:** `apps/backend/src/modules/business-central/__tests__/get-return.spec.ts` (new file)
- **Naming conventions:** camelCase functions and variables, PascalCase types, kebab-case files.
  Double-quoted strings and semicolons, matching `service.ts`. `service.ts` and `types.ts` use
  **CRLF** line endings; keep them CRLF.

## Solution Design

Add `getReturn(params)` to `IBusinessCentralModuleService` and `BusinessCentralModuleService`.
It loads **one open return order** for the caller's BC customer, with its lines, and computes the
expected credit. It returns `null` when nothing matches, which covers a foreign, unknown or
already-processed return. BC deletes return orders once they are posted, so they are gone from
this entity set.

### Endpoint (verified against TestDK on 2026-09-29)

Use the **Abakion customer-portal API**, not the standard v2.0 API:

```
{environmentBaseUrl}/api/abakion/customerPortal/v2.0/companies({BUSINESS_CENTRAL_COMPANY_ID})/salesReturnOrders
```

- Only the Abakion `salesReturnOrderLine` exposes `variantCode` and `returnReasonCode`, and the
  page must show both. The standard v2.0 line has neither: `$select=variantCode` on the v2.0
  expand returns HTTP 400 on TestDK.
- The Abakion header schema is the same as v2.0 (`number`, `documentDate`, `status`,
  `currencyCode`, `pricesIncludingVAT`, `sellToCustomerNumber`).
- It needs no extra round trip. `getCompanyId()` reads `BUSINESS_CENTRAL_COMPANY_ID`, which
  NIMBUS-138 already requires, and `getEnvironmentBaseUrl()` already exists. The call sequence
  is one token request plus one data request, which meets the scope's performance requirement.
- Scoping is `$filter=number eq '<n>' and sellToCustomerNumber eq '<customerNo>'`, with `$top=1`.
  On TestDK this gave the expected results: own return, 1 row; a different customer number,
  0 rows; an unknown number, 0 rows; `a''b` (escaped quote), HTTP 200 with 0 rows.
- `$select` limits the header to the fields we use, and never requests addresses, contacts or
  `externalDocumentNumber` (the portal `requestId`).

### Mapping rules (all verified against 7 TestDK return orders)

- **Status:** decode XML-encoded enum names (`Pending_x0020_Approval` becomes
  `Pending Approval`) with a new generic `decodeBCEnumValue` helper. NIMBUS-140's list mapper is
  switched to the same helper (Edit 3), so list and detail decode identically.
- **Lines:** sort by `sequence`. **Exclude BC text lines**, whose `lineType` is `_x0020_` (blank).
  BC inserts them when it copies posted lines, for example `"Fakturanr. SIN47206:"` or
  `"Leverancenr. 30900312:"`. They carry no item, quantity or amount, and their text is in the
  company language. On TestDK the only line types are `_x0020_` and `Item`. Freight is an
  `Item` line (for example `F2` "Small Freight"), so it is kept and credited.
- **Per-line fields:** item number (`lineObjectNumber`), `variantCode`, `description`,
  `unitOfMeasureCode`, `quantity`, `returnQtyReceived`, `returnReasonCode` (raw code, for
  example `NORMAL`). **No per-line prices or amounts are returned** (scope decision Q4).
- **Expected credit** (the header has no total fields):
  - `amountIncludingTax` = Σ `amountIncludingTax` over **all** lines, rounded to 2 decimals.
  - `amountExcludingTax` = Σ `lineAmount` over all lines, rounded to 2 decimals, **only when
    `pricesIncludingVAT` is false**. When it is true, `lineAmount` already includes VAT, so the
    value is `null` and the page shows the incl.-VAT figure only.
  - Evidence: for all 7 TestDK return orders, Σ `lineAmount` equals BC's own header `Amount` and
    Σ `amountIncludingTax` equals BC's `Amount Including VAT`. These were read from the ODataV4
    `salesDocuments` web service, for example `31502910`: 1279.00 / 1598.75 DKK. In TestDK,
    0 sales documents have `pricesIncludingVat = true` and 0 have `invoiceDiscountAmount > 0`.
    Text lines have 0 amounts, so summing all lines equals summing the amount-bearing lines.
  - `currencyCode` = the header `currencyCode`. **A blank value means the company's local
    currency (LCY).** On TestDK, LCY return orders (`31502906`, `31502910`–`31502912`) send
    `""`, while v2.0 `salesOrders` send `"DKK"`. A blank value is resolved to
    `BUSINESS_CENTRAL_LCY_CODE` (default `DKK`), which is the same rule and environment variable
    as `resolveCurrencyCode` in `apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts`.
    That function is private to a workflow step, and a module must not import from workflows,
    so a 5-line module-local helper is used instead.

**Cross-task wiring:** `BCGetReturnParams`, `BCReturnDetail`, `BCReturnDetailLine`,
`BCReturnExpectedCredit` and `getReturn` are consumed by Task 02 (route). Task 03 mirrors the
response shape in the storefront types.

**Extensibility for NIMBUS-172:** the detail shape has no open/posted discriminator yet, so no
speculative fields are added. NIMBUS-172 can add a posted-receipt lookup, for example keyed on
`Return_Order_No`, behind the same route when `getReturn` returns `null`.

## Impacted Files

### `apps/backend/src/modules/business-central/types.ts` (edit)

**Edit 1: add the new types.** Insert them directly **before** the line
`export interface IBusinessCentralModuleService {`. After NIMBUS-140, that line directly follows
`BCListReturnsResult`. Leave everything above it unchanged.

```typescript
export type BCGetReturnParams = {
  customerNumber: string;
  returnNumber: string;
};

export type BCReturnDetailLine = {
  id: string;
  sequence: number;
  lineType: string;
  itemNumber: string;
  variantCode: string;
  description: string;
  unitOfMeasureCode: string;
  quantity: number;
  quantityReceived: number;
  returnReasonCode: string;
};

export type BCReturnExpectedCredit = {
  currencyCode: string;
  amountIncludingTax: number;
  amountExcludingTax: number | null;
};

export type BCReturnDetail = {
  id: string;
  number: string;
  documentDate: string;
  status: string;
  lines: BCReturnDetailLine[];
  expectedCredit: BCReturnExpectedCredit;
};

```

**Edit 2: add the interface method.**

Old:
```typescript
  getOrder(params: BCGetOrderParams): Promise<BCOrderDetail | null>;
```

New:
```typescript
  getOrder(params: BCGetOrderParams): Promise<BCOrderDetail | null>;
  getReturn(params: BCGetReturnParams): Promise<BCReturnDetail | null>;
```

### `apps/backend/src/modules/business-central/service.ts` (edit)

**Edit 1: type imports.** In the `import type { ... } from "./types";` block at the top of the
file, add these three names on new lines directly after the existing `  BCGetOrderParams,` line.
Do not reorder the other names:

```typescript
  BCGetReturnParams,
  BCReturnDetail,
  BCReturnDetailLine,
```

**Edit 2: constants.** Insert these three constants directly after the existing line
`const BC_EMPTY_DATE = "0001-01-01";`:

```typescript
const DEFAULT_BUSINESS_CENTRAL_LCY_CODE = "DKK";
const RETURN_ORDER_DETAIL_FIELDS =
  "id,number,documentDate,status,currencyCode,pricesIncludingVAT";
const RETURN_ORDER_DETAIL_LINE_FIELDS =
  "id,sequence,lineType,lineObjectNumber,variantCode,description,unitOfMeasureCode,quantity,returnQtyReceived,returnReasonCode,lineAmount,amountIncludingTax";
```

**Edit 3: switch NIMBUS-140's list mapper to the shared decoder.** This is a one-line change in
`mapSalesReturnOrderToListItem`, which NIMBUS-140 added. NIMBUS-140's TC-5 (`Pending_x0020_Approval`
becomes `Pending Approval`) must stay green.

Old:
```typescript
    // BC sends enum members XML-encoded, e.g. "Pending_x0020_Approval".
    status: optionalString(item.status).replace(/_x0020_/g, " "),
```

New:
```typescript
    status: decodeBCEnumValue(item.status),
```

**Edit 4: helpers, raw types and the detail mapper.** Insert this block directly **before** the
line `class BusinessCentralModuleService implements IBusinessCentralModuleService {`, which after
NIMBUS-140 follows `mapSalesReturnOrderToListItem`. Function declarations are hoisted, so Edit 3
may reference `decodeBCEnumValue` even though it is declared below it.

```typescript
// BC sends enum members XML-encoded, e.g. "Pending_x0020_Approval" or "_x0020_" (blank).
function decodeBCEnumValue(value: unknown): string {
  return optionalString(value).replace(/_x([0-9A-Fa-f]{4})_/g, (_match, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

function optionalNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function roundCurrencyAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

// A blank BC currency code means the company's local currency (LCY). Same rule and env var as
// resolveCurrencyCode in workflows/company/steps/prepare-company-bc-sync.ts.
function resolveBCCurrencyCode(value: unknown): string {
  const currencyCode = optionalString(value).trim();

  if (currencyCode) {
    return currencyCode;
  }

  return process.env.BUSINESS_CENTRAL_LCY_CODE?.trim() || DEFAULT_BUSINESS_CENTRAL_LCY_CODE;
}

type BCSalesReturnOrderDetailLineRaw = {
  id?: unknown;
  sequence?: unknown;
  lineType?: unknown;
  lineObjectNumber?: unknown;
  variantCode?: unknown;
  description?: unknown;
  unitOfMeasureCode?: unknown;
  quantity?: unknown;
  returnQtyReceived?: unknown;
  returnReasonCode?: unknown;
  lineAmount?: unknown;
  amountIncludingTax?: unknown;
};

type BCSalesReturnOrderDetailRaw = {
  id?: unknown;
  number?: unknown;
  documentDate?: unknown;
  status?: unknown;
  currencyCode?: unknown;
  pricesIncludingVAT?: unknown;
  salesReturnOrderLines?: BCSalesReturnOrderDetailLineRaw[];
};

function mapSalesReturnOrderDetailLine(
  line: BCSalesReturnOrderDetailLineRaw
): BCReturnDetailLine {
  return {
    id: optionalString(line.id),
    sequence: optionalNumber(line.sequence),
    lineType: decodeBCEnumValue(line.lineType),
    itemNumber: optionalString(line.lineObjectNumber),
    variantCode: optionalString(line.variantCode),
    description: optionalString(line.description),
    unitOfMeasureCode: optionalString(line.unitOfMeasureCode),
    quantity: optionalNumber(line.quantity),
    quantityReceived: optionalNumber(line.returnQtyReceived),
    returnReasonCode: optionalString(line.returnReasonCode),
  };
}

function mapSalesReturnOrderToDetail(raw: BCSalesReturnOrderDetailRaw): BCReturnDetail {
  const rawLines = [...(raw.salesReturnOrderLines ?? [])].sort(
    (left, right) => optionalNumber(left.sequence) - optionalNumber(right.sequence)
  );
  const amountIncludingTax = rawLines.reduce(
    (sum, line) => sum + optionalNumber(line.amountIncludingTax),
    0
  );
  const lineAmount = rawLines.reduce(
    (sum, line) => sum + optionalNumber(line.lineAmount),
    0
  );

  return {
    id: optionalString(raw.id),
    number: requireBusinessCentralString(raw.number, "number"),
    documentDate: optionalString(raw.documentDate),
    status: decodeBCEnumValue(raw.status),
    lines: rawLines
      // BC text lines (blank line type, e.g. "Invoice No. ...:") carry no item or quantity.
      .filter((line) => decodeBCEnumValue(line.lineType).trim() !== "")
      .map(mapSalesReturnOrderDetailLine),
    expectedCredit: {
      currencyCode: resolveBCCurrencyCode(raw.currencyCode),
      amountIncludingTax: roundCurrencyAmount(amountIncludingTax),
      // lineAmount already includes VAT when prices include VAT, so no net figure can be derived.
      amountExcludingTax:
        raw.pricesIncludingVAT === true ? null : roundCurrencyAmount(lineAmount),
    },
  };
}

```

**Edit 5: the `getReturn` method.** Insert it directly **after** the complete `getOrder` method,
as the last method of the class. The end of the file changes like this.

Old (end of file):
```typescript
      invoiceStatus: "fully_invoiced",
      lines,
      invoices: invoices.map(mapSalesInvoiceToSummary),
    };
  }
}

export default BusinessCentralModuleService;
```

New (end of file):
```typescript
      invoiceStatus: "fully_invoiced",
      lines,
      invoices: invoices.map(mapSalesInvoiceToSummary),
    };
  }

  // Reads the Abakion customer-portal API: unlike the standard v2.0 API, its return order
  // lines expose variantCode and returnReasonCode.
  async getReturn(params: BCGetReturnParams): Promise<BCReturnDetail | null> {
    const discoveryUrl = this.getDiscoveryUrl();
    const tenantId = this.getTenantId(discoveryUrl);
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);

    const returnUrl = new URL(
      `${this.getEnvironmentBaseUrl(discoveryUrl)}/${CUSTOMER_PORTAL_API_PATH}/companies(${this.getCompanyId()})/salesReturnOrders`
    );
    returnUrl.searchParams.set(
      "$filter",
      [
        `number eq '${escapeODataString(params.returnNumber)}'`,
        `sellToCustomerNumber eq '${escapeODataString(params.customerNumber)}'`,
      ].join(" and ")
    );
    returnUrl.searchParams.set("$top", "1");
    returnUrl.searchParams.set("$select", RETURN_ORDER_DETAIL_FIELDS);
    returnUrl.searchParams.set(
      "$expand",
      `salesReturnOrderLines($select=${RETURN_ORDER_DETAIL_LINE_FIELDS})`
    );

    const returnResponse = await fetch(returnUrl.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });

    if (!returnResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central return order request failed with status ${returnResponse.status}`
      );
    }

    const returnBody = (await returnResponse.json()) as {
      value?: BCSalesReturnOrderDetailRaw[];
    };
    const raw = returnBody.value?.[0];

    return raw ? mapSalesReturnOrderToDetail(raw) : null;
  }
}

export default BusinessCentralModuleService;
```

## Code Skeletons

### New File: `apps/backend/src/modules/business-central/__tests__/get-return.spec.ts`

Complete file. Write it exactly as below; there are no `IMPLEMENT` blocks.

```typescript
import BusinessCentralModuleService from "../service";

const originalFetch = global.fetch;
const originalLcyCode = process.env.BUSINESS_CENTRAL_LCY_CODE;
const COMPANY_ID = "00000000-0000-0000-0000-0000000000c1";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockReturnResponse(body: unknown, status = 200): jest.Mock {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
    .mockResolvedValueOnce(jsonResponse(body, status));
  global.fetch = fetchMock;
  return fetchMock;
}

// Shape of TestDK return order 31502910 (verified 2026-09-29), trimmed to the selected fields.
function rawReturnOrder(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "return-1",
    number: "31502910",
    documentDate: "2026-09-27",
    status: "Pending_x0020_Approval",
    currencyCode: "",
    pricesIncludingVAT: false,
    salesReturnOrderLines: [
      {
        id: "line-60000",
        sequence: 60000,
        lineType: "Item",
        lineObjectNumber: "F2",
        variantCode: "",
        description: "Small Freight",
        unitOfMeasureCode: "PCS",
        quantity: 1,
        returnQtyReceived: 0,
        returnReasonCode: "NORMAL",
        lineAmount: 50,
        amountIncludingTax: 62.5,
      },
      {
        id: "line-10000",
        sequence: 10000,
        lineType: "_x0020_",
        lineObjectNumber: "",
        variantCode: "",
        description: "Fakturanr. SIN47206:",
        unitOfMeasureCode: "",
        quantity: 0,
        returnQtyReceived: 0,
        returnReasonCode: "",
        lineAmount: 0,
        amountIncludingTax: 0,
      },
      {
        id: "line-30000",
        sequence: 30000,
        lineType: "Item",
        lineObjectNumber: "FVIE-M-BLACK",
        variantCode: "XL",
        description: "Fjeld Vest",
        unitOfMeasureCode: "PCS",
        quantity: 2,
        returnQtyReceived: 1,
        returnReasonCode: "NORMAL",
        lineAmount: 1229,
        amountIncludingTax: 1536.25,
      },
    ],
    ...overrides,
  };
}

describe("BusinessCentralModuleService.getReturn", () => {
  beforeEach(() => {
    process.env.BUSINESS_CENTRAL_DISCOVERY_URL =
      "https://api.businesscentral.dynamics.com/v2.0/tenant-id/Sandbox/api/v2.0";
    process.env.BUSINESS_CENTRAL_CLIENT_ID = "00000000-0000-0000-0000-000000000001";
    process.env.BUSINESS_CENTRAL_CLIENT_SECRET = "client-secret";
    process.env.BUSINESS_CENTRAL_COMPANY_ID = COMPANY_ID;
    delete process.env.BUSINESS_CENTRAL_LCY_CODE;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalLcyCode === undefined) {
      delete process.env.BUSINESS_CENTRAL_LCY_CODE;
    } else {
      process.env.BUSINESS_CENTRAL_LCY_CODE = originalLcyCode;
    }
  });

  // TC-1: happy path — maps header, sorted item lines without prices, and the expected credit.
  it("maps the return order, drops text lines and sums the expected credit", async () => {
    const fetchMock = mockReturnResponse({ value: [rawReturnOrder()] });
    const service = new BusinessCentralModuleService();

    await expect(
      service.getReturn({ customerNumber: "10000", returnNumber: "31502910" })
    ).resolves.toEqual({
      id: "return-1",
      number: "31502910",
      documentDate: "2026-09-27",
      status: "Pending Approval",
      lines: [
        {
          id: "line-30000",
          sequence: 30000,
          lineType: "Item",
          itemNumber: "FVIE-M-BLACK",
          variantCode: "XL",
          description: "Fjeld Vest",
          unitOfMeasureCode: "PCS",
          quantity: 2,
          quantityReceived: 1,
          returnReasonCode: "NORMAL",
        },
        {
          id: "line-60000",
          sequence: 60000,
          lineType: "Item",
          itemNumber: "F2",
          variantCode: "",
          description: "Small Freight",
          unitOfMeasureCode: "PCS",
          quantity: 1,
          quantityReceived: 0,
          returnReasonCode: "NORMAL",
        },
      ],
      expectedCredit: {
        currencyCode: "DKK",
        amountIncludingTax: 1598.75,
        amountExcludingTax: 1279,
      },
    });
    // Token + one data call; no customer-GUID or company-name lookups.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // TC-2: wiring — Abakion endpoint, customer-scoped filter, $top=1, $select and $expand.
  it("queries the customer-portal salesReturnOrders scoped to the customer number", async () => {
    const fetchMock = mockReturnResponse({ value: [] });
    const service = new BusinessCentralModuleService();

    await service.getReturn({ customerNumber: "10000", returnNumber: "RO'1" });

    const requestUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(`${requestUrl.origin}${requestUrl.pathname}`).toBe(
      `https://api.businesscentral.dynamics.com/v2.0/tenant-id/Sandbox/api/abakion/customerPortal/v2.0/companies(${COMPANY_ID})/salesReturnOrders`
    );
    expect(requestUrl.searchParams.get("$filter")).toBe(
      "number eq 'RO''1' and sellToCustomerNumber eq '10000'"
    );
    expect(requestUrl.searchParams.get("$top")).toBe("1");
    expect(requestUrl.searchParams.get("$select")).toBe(
      "id,number,documentDate,status,currencyCode,pricesIncludingVAT"
    );
    expect(requestUrl.searchParams.get("$expand")).toBe(
      "salesReturnOrderLines($select=id,sequence,lineType,lineObjectNumber,variantCode,description,unitOfMeasureCode,quantity,returnQtyReceived,returnReasonCode,lineAmount,amountIncludingTax)"
    );
    expect(requestUrl.searchParams.get("$select")).not.toContain("externalDocumentNumber");
  });

  // TC-3: edge case — foreign, unknown or already-processed returns come back empty → null.
  it("returns null when no open return order matches the number and customer", async () => {
    mockReturnResponse({ value: [] });
    const service = new BusinessCentralModuleService();

    await expect(
      service.getReturn({ customerNumber: "10000", returnNumber: "99999999" })
    ).resolves.toBeNull();
  });

  // TC-4: error condition — a non-OK BC response throws.
  it("throws when the return order request fails", async () => {
    mockReturnResponse({}, 500);
    const service = new BusinessCentralModuleService();

    await expect(
      service.getReturn({ customerNumber: "10000", returnNumber: "31502910" })
    ).rejects.toThrow("Business Central return order request failed with status 500");
  });

  // TC-5: edge case — prices incl. VAT gives no net figure; explicit currency is kept.
  it("omits the excluding-tax credit when prices include VAT and keeps a foreign currency", async () => {
    mockReturnResponse({
      value: [rawReturnOrder({ currencyCode: "SEK", pricesIncludingVAT: true })],
    });
    const service = new BusinessCentralModuleService();

    const result = await service.getReturn({
      customerNumber: "10000",
      returnNumber: "31502910",
    });

    expect(result?.expectedCredit).toEqual({
      currencyCode: "SEK",
      amountIncludingTax: 1598.75,
      amountExcludingTax: null,
    });
  });

  // TC-6: edge case — blank currency honours BUSINESS_CENTRAL_LCY_CODE; sums are rounded.
  it("resolves a blank currency to BUSINESS_CENTRAL_LCY_CODE and rounds the sums", async () => {
    process.env.BUSINESS_CENTRAL_LCY_CODE = "NOK";
    mockReturnResponse({
      value: [
        rawReturnOrder({
          salesReturnOrderLines: [
            { id: "a", sequence: 10000, lineType: "Item", lineAmount: 0.1, amountIncludingTax: 0.1 },
            { id: "b", sequence: 20000, lineType: "Item", lineAmount: 0.2, amountIncludingTax: 0.2 },
          ],
        }),
      ],
    });
    const service = new BusinessCentralModuleService();

    const result = await service.getReturn({
      customerNumber: "10000",
      returnNumber: "31502910",
    });

    expect(result?.expectedCredit).toEqual({
      currencyCode: "NOK",
      amountIncludingTax: 0.3,
      amountExcludingTax: 0.3,
    });
    expect(result?.lines).toHaveLength(2);
    expect(result?.lines[0]).toEqual({
      id: "a",
      sequence: 10000,
      lineType: "Item",
      itemNumber: "",
      variantCode: "",
      description: "",
      unitOfMeasureCode: "",
      quantity: 0,
      quantityReceived: 0,
      returnReasonCode: "",
    });
  });
});
```

## Test Cases

### TC-1: Happy path, mapping and expected credit
- **Given:** BC returns return order `31502910`, with a blank currency, `pricesIncludingVAT: false`, status `Pending_x0020_Approval` and three unsorted lines, one of which is a `_x0020_` text line.
- **When:** `getReturn({ customerNumber: "10000", returnNumber: "31502910" })` is called.
- **Then:** the status is `Pending Approval`, and the two item lines are sorted by sequence with no price or amount properties. The text line is dropped. The expected credit is `{ DKK, 1598.75, 1279 }`, and exactly 2 `fetch` calls are made.

### TC-2: Wiring, endpoint and scoping
- **Given:** a return number that contains a quote.
- **When:** `getReturn` is called.
- **Then:** the request goes to the Abakion `customerPortal` `salesReturnOrders` path for the configured company, with `$filter` `number eq 'RO''1' and sellToCustomerNumber eq '10000'` (quote escaped), `$top=1`, the exact `$select` and `$expand`, and no `externalDocumentNumber`.

### TC-3: Edge case, not found
- **Given:** BC returns `{ value: [] }`.
- **When:** `getReturn` is called.
- **Then:** it resolves to `null`.

### TC-4: Error condition
- **Given:** BC responds with HTTP 500.
- **When:** `getReturn` is called.
- **Then:** it rejects with `Business Central return order request failed with status 500`.

### TC-5: Edge case, prices including VAT
- **Given:** `pricesIncludingVAT: true` and `currencyCode: "SEK"`.
- **When:** `getReturn` is called.
- **Then:** `amountExcludingTax` is `null`, `amountIncludingTax` is still summed, and the currency is `SEK`.

### TC-6: Edge case, LCY env var and rounding
- **Given:** `BUSINESS_CENTRAL_LCY_CODE=NOK`, a blank currency, and line amounts 0.1 + 0.2.
- **When:** `getReturn` is called.
- **Then:** the currency is `NOK`, both sums are exactly `0.3`, and missing line fields default to `""`/`0`.

### TC-7: Regression, NIMBUS-140 list status decoding (existing test)
- **Given:** Edit 3 switches `mapSalesReturnOrderToListItem` to `decodeBCEnumValue`.
- **When:** `service.spec.ts` runs.
- **Then:** NIMBUS-140's `listReturns` TC-5 (`Pending_x0020_Approval` becomes `Pending Approval`) still passes.

## Implementation Steps

1. Confirm that NIMBUS-140 is merged (see the blocked note at the top).
2. Apply `types.ts` Edits 1 and 2.
3. Apply `service.ts` Edits 1 to 5 exactly. Do not modify any other code.
4. Create `__tests__/get-return.spec.ts` exactly as specified.
5. Run `cd apps/backend && pnpm test:integration:modules`. The 6 new tests must pass, and so
   must all NIMBUS-140 `listReturns` tests. The known pre-existing baseline failure,
   `listOrders › stops filling from salesInvoices after the round-trip guardrail…`, is reported
   twice because of the `.medusa/server` copy. It is unrelated; do not fix it.
6. Run `pnpm build` (repo root) and `pnpm lint`. Neither may report new errors.
