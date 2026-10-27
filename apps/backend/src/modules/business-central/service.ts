import type { Logger } from "@medusajs/framework/types";
import { MedusaError } from "@medusajs/framework/utils";
import type {
  BCAcceptedSalesOrderLine,
  BCCreatedSalesOrder,
  BCCreateSalesOrderLineInput,
  BCCreateSalesOrderParams,
  BCGetOrderParams,
  BCGetReturnParams,
  BCReturnDetail,
  BCReturnDetailLine,
  BCListOrdersParams,
  BCListOrdersResult,
  BCListReturnsParams,
  BCListReturnsResult,
  BCOrder,
  BCOrderDetail,
  BCOrderInvoiceSummary,
  BCOrderLine,
  BCOrderLineReservation,
  BCCreateReturnParams,
  BCCustomer,
  BCCustomerBlockedState,
  BCItem,
  BCItemBarcodeReference,
  BCItemLookupEvidence,
  BCItemLookupInput,
  BCReturnListItem,
  BCReturnOrder,
  BCReturnReason,
  BCReturnSource,
  BCSalesOrderAddressInput,
  BCSalesOrderLineRejection,
  BCShipment,
  BCShipmentHeader,
  BCShipmentLineVariant,
  BCShipmentWindow,
  BusinessCentralEnvironment,
  IBusinessCentralModuleService,
} from "./types";
import {
  getBusinessCentralCompanyId,
  getBusinessCentralEndpoint,
  getBusinessCentralLocalCurrency,
} from "./environment-config";
import type { BusinessCentralEndpoint } from "./environment-config";
import {
  ShipmentReadDeadlineError,
  BusinessCentralThrottledError,
  buildODataCompanyParameter,
  buildShipmentLineVariantFilter,
  buildShipmentNumberFilter,
  buildShipmentWindowFilter,
  chunkShipmentNumbers,
  isThrottlingStatus,
  mapShipment,
  mapShipmentHeader,
  mapShipmentLineVariant,
  parseRetryAfterSeconds,
  SHIPMENT_DETAIL_FIELDS,
  SHIPMENT_HEADER_FIELDS,
  SHIPMENT_LINE_FIELDS,
  SHIPMENT_LINE_VARIANT_ENTITY_SET,
  SHIPMENT_LINE_VARIANT_FIELDS,
  SHIPMENT_PAGE_SIZE,
  SHIPMENT_REQUEST_TIMEOUT_MS,
  SHIPMENT_TOKEN_RENEW_BEFORE_MS,
} from "./shipment-reads";
import type { BCSalesShipmentRaw, BCShipmentLineVariantRaw } from "./shipment-reads";
import {
  buildPostedReturnReceipts,
  buildReturnListRows,
  countReceiptItems,
  filterReturnListRows,
  latestReceivedDate,
} from "./return-history";
import type {
  PostedReturnReceiptHeader,
  PostedReturnReceiptLineRecord,
} from "./return-history";
import {
  chunkLookupValues,
  collectItemNumbers,
  collectLineBarcodes,
  ITEM_LOOKUP_EXPAND,
  ITEM_LOOKUP_SELECT,
  ITEM_REFERENCE_ENTITY_SET,
  ITEM_REFERENCE_FIELDS,
  mapItemBarcodeReference,
  mapLookupItem,
} from "./item-lookup-evidence";
import type { BCItemLookupItemRaw, BCItemReferenceRaw } from "./item-lookup-evidence";

const BUSINESS_CENTRAL_SCOPE =
  "https://api.businesscentral.dynamics.com/.default";
const AZURE_GUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const BC_BLOCKED_UNBLOCKED_WIRE_VALUE = "_x0020_";
const BC_BLOCKED_STATES: readonly BCCustomerBlockedState[] = [
  "not_blocked",
  "Ship",
  "Invoice",
  "All",
];
const SALES_ORDER_DEDUP_FETCH_CAP = 10000;
const INVOICE_FILL_BATCH_SIZE = 50;
const MAX_INVOICE_FILL_ROUND_TRIPS = 50;
const MAX_ORDER_DETAIL_INVOICES = 50;
const CREATE_RETURN_ORDER_ACTION = "CustomerPortalReturns_CreateReturnOrder";
const ENABLED_REASON_CODES_ENTITY_SET = "CS_EnabledReasonCodes";
const CREATE_RETURN_TIMEOUT_MS = 30000;
const CUSTOMER_PORTAL_API_PATH = "api/abakion/customerPortal/v2.0";
const BC_EMPTY_DATE = "0001-01-01";
const RETURN_ORDER_DETAIL_FIELDS =
  "id,number,documentDate,status,currencyCode,pricesIncludingVAT";
const RETURN_ORDER_DETAIL_LINE_FIELDS =
  "id,sequence,lineType,lineObjectNumber,variantCode,description,unitOfMeasureCode,quantity,returnQtyReceived,returnReasonCode,lineAmount,amountIncludingTax";
const OPEN_RETURN_ORDER_LIST_FIELDS = "id,number,documentDate,status";
const OPEN_RETURN_ORDER_FETCH_CAP = 1000;
const POSTED_RETURN_RECEIPT_ENTITY_SET = "PostedReturnReceipt";
const POSTED_RETURN_RECEIPT_LINES_ENTITY_SET = "PostedReturnReceiptReturnRcptLines";
// Header fields only: the web service also carries names, addresses, phone and e-mail.
const POSTED_RETURN_RECEIPT_FIELDS = "No,Return_Order_No,External_Document_No,Document_Date";
const POSTED_RETURN_RECEIPT_LIST_LINE_FIELDS = "Document_No,Type,No,Variant_Code,Quantity";
const POSTED_RETURN_RECEIPT_FETCH_CAP = 5000;
const POSTED_RETURN_RECEIPT_LINE_FILTER_CHUNK_SIZE = 20;
const POSTED_RETURN_RECEIPT_DETAIL_LINE_FIELDS =
  "Document_No,Line_No,Type,No,Variant_Code,Description,Quantity,Unit_of_Measure_Code,Return_Reason_Code";
const MAX_RETURN_DETAIL_RECEIPTS = 100;
const CREATE_SALES_ORDER_TIMEOUT_MS = 30000;

type BusinessCentralTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type BusinessCentralTokenErrorResponse = {
  error?: string;
  error_description?: string;
};

type ShipmentPageBody<TRow> = {
  value?: TRow[];
  "@odata.nextLink"?: unknown;
  "@odata.count"?: unknown;
};

export class BusinessCentralAmbiguousOutcomeError extends Error {
  constructor(
    message: string,
    readonly idempotencyKey: string
  ) {
    super(message);
    this.name = "BusinessCentralAmbiguousOutcomeError";
  }
}

function requireBusinessCentralString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Business Central response field ${fieldName} must be a string`
    );
  }

  return value;
}

function optionalString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeBlockedState(value: unknown): BCCustomerBlockedState {
  if (
    value === BC_BLOCKED_UNBLOCKED_WIRE_VALUE ||
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "not_blocked";
  }

  if (
    typeof value === "string" &&
    BC_BLOCKED_STATES.includes(value as BCCustomerBlockedState)
  ) {
    return value as BCCustomerBlockedState;
  }

  throw new MedusaError(
    MedusaError.Types.UNEXPECTED_STATE,
    "Unsupported Business Central blocked value"
  );
}

function parseCreditLimit(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  throw new MedusaError(
    MedusaError.Types.UNEXPECTED_STATE,
    "Malformed Business Central creditLimit"
  );
}

function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

function formatAddress(
  name: string | undefined,
  addressLine1: string | undefined,
  addressLine2: string | undefined,
  city: string | undefined,
  postalCode: string | undefined,
  country: string | undefined
): string[] {
  const cityLine = [postalCode, city].filter(Boolean).join(" ");

  return [name, addressLine1, addressLine2, cityLine, country].filter(
    (value): value is string => Boolean(value)
  );
}

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

  assignIfDefined(body, "itemVariantId", line.itemVariantId);
  assignIfDefined(body, "unitOfMeasureCode", line.unitOfMeasureCode);
  assignIfDefined(body, "shipmentDate", line.shipmentDate);

  return body;
}

type BCSalesOrderRaw = {
  id: string;
  number: unknown;
  orderDate: string;
  customerNumber: string;
  customerName: string;
  billToName?: string;
  billToAddressLine1?: string;
  billToAddressLine2?: string;
  billToCity?: string;
  billToPostalCode?: string;
  billToCountry?: string;
  shipToName?: string;
  shipToAddressLine1?: string;
  shipToAddressLine2?: string;
  shipToCity?: string;
  shipToPostalCode?: string;
  shipToCountry?: string;
  status: string;
  currencyCode: string;
  totalAmountExcludingTax?: number;
  totalAmountIncludingTax?: number;
};

type BCSalesInvoiceRaw = {
  id: string;
  number: unknown;
  orderNumber: unknown;
  invoiceDate: string;
  customerNumber: string;
  customerName: string;
  billToName?: string;
  billToAddressLine1?: string;
  billToAddressLine2?: string;
  billToCity?: string;
  billToPostCode?: string;
  billToCountry?: string;
  shipToName?: string;
  shipToAddressLine1?: string;
  shipToAddressLine2?: string;
  shipToCity?: string;
  shipToPostCode?: string;
  shipToCountry?: string;
  status: string;
  currencyCode: string;
  totalAmountExcludingTax?: number;
  totalAmountIncludingTax?: number;
};

function mapSalesOrderToBCOrder(item: BCSalesOrderRaw): BCOrder {
  return {
    id: item.id,
    number: requireBusinessCentralString(item.number, "number"),
    orderDate: item.orderDate,
    customerNumber: item.customerNumber,
    customerName: item.customerName,
    billToAddress: formatAddress(
      item.billToName,
      item.billToAddressLine1,
      item.billToAddressLine2,
      item.billToCity,
      item.billToPostalCode,
      item.billToCountry
    ),
    shipToAddress: formatAddress(
      item.shipToName,
      item.shipToAddressLine1,
      item.shipToAddressLine2,
      item.shipToCity,
      item.shipToPostalCode,
      item.shipToCountry
    ),
    status: item.status,
    invoiceStatus: "open",
    currencyCode: item.currencyCode,
    totalAmountExcludingTax: item.totalAmountExcludingTax ?? 0,
    totalAmountIncludingTax: item.totalAmountIncludingTax ?? 0,
  };
}

function mapSalesInvoiceToBCOrder(item: BCSalesInvoiceRaw): BCOrder {
  return {
    id: item.id,
    number: requireBusinessCentralString(item.orderNumber, "orderNumber"),
    orderDate: item.invoiceDate,
    customerNumber: item.customerNumber,
    customerName: item.customerName,
    billToAddress: formatAddress(
      item.billToName,
      item.billToAddressLine1,
      item.billToAddressLine2,
      item.billToCity,
      item.billToPostCode,
      item.billToCountry
    ),
    shipToAddress: formatAddress(
      item.shipToName,
      item.shipToAddressLine1,
      item.shipToAddressLine2,
      item.shipToCity,
      item.shipToPostCode,
      item.shipToCountry
    ),
    status: item.status,
    invoiceStatus: "fully_invoiced",
    currencyCode: item.currencyCode,
    totalAmountExcludingTax: item.totalAmountExcludingTax ?? 0,
    totalAmountIncludingTax: item.totalAmountIncludingTax ?? 0,
  };
}

type BCSalesOrderLineRaw = {
  id: string;
  sequence: number;
  lineType?: string;
  itemId?: string;
  item?: { number?: string; displayName?: string };
  itemVariant?: { code?: string } | null;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  amountExcludingTax?: number;
  shippedQuantity?: number;
  invoicedQuantity?: number;
};

type BCReservationEntryRaw = {
  id?: unknown;
  itemNumber?: unknown;
  variantCode?: unknown;
  reservationStatus?: unknown;
  quantityBase?: unknown;
  reservedFrom?: unknown;
  locationCode?: unknown;
  freightType?: unknown;
  expectedReceiptDate?: unknown;
  shipmentDate?: unknown;
};

type BCItemReservation = {
  itemNumber: string;
  variantCode: string;
  reservation: BCOrderLineReservation;
};

// Reservation entries describe the supply side (e.g. the purchase order line), so they cannot be
// matched by line number; they are matched to the order's lines by item and variant instead,
// filling the lines that still have unshipped quantity first.
function allocateReservations(
  lines: BCSalesOrderLineRaw[],
  itemReservations: BCItemReservation[]
): Map<string, BCOrderLineReservation[]> {
  const reservationsByLineId = new Map<string, BCOrderLineReservation[]>();
  const openQuantityByLineId = new Map(
    lines.map((line) => [line.id, (line.quantity ?? 0) - (line.shippedQuantity ?? 0)])
  );

  for (const { itemNumber, variantCode, reservation } of itemReservations) {
    const candidates = lines.filter(
      (line) =>
        line.lineType === "Item" &&
        line.item?.number === itemNumber &&
        (line.itemVariant?.code ?? "") === variantCode
    );
    const target =
      candidates.find((line) => (openQuantityByLineId.get(line.id) ?? 0) > 0) ??
      candidates[0];

    if (!target) {
      continue;
    }

    openQuantityByLineId.set(
      target.id,
      (openQuantityByLineId.get(target.id) ?? 0) - reservation.quantity
    );
    reservationsByLineId.set(target.id, [
      ...(reservationsByLineId.get(target.id) ?? []),
      reservation,
    ]);
  }

  return reservationsByLineId;
}

function optionalDate(value: unknown): string | null {
  return typeof value === "string" && value !== "" && value !== BC_EMPTY_DATE
    ? value
    : null;
}

type BCSalesInvoiceLineRaw = {
  id: string;
  sequence: number;
  lineType?: string;
  itemId?: string;
  item?: { number?: string; displayName?: string };
  itemVariant?: { code?: string } | null;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  amountExcludingTax?: number;
};

function variantCodeOf(line: { itemVariant?: { code?: string } | null }): { variantCode?: string } {
  const code = line.itemVariant?.code;
  return typeof code === "string" && code !== "" ? { variantCode: code } : {};
}

function mapSalesOrderLine(
  line: BCSalesOrderLineRaw,
  reservations: BCOrderLineReservation[] = []
): BCOrderLine {
  const shippedQuantity = line.shippedQuantity ?? 0;

  return {
    id: line.id,
    sequence: line.sequence,
    lineType: line.lineType ?? "",
    itemId: line.itemId,
    itemNumber: line.item?.number,
    itemDisplayName: line.item?.displayName,
    description: line.description ?? "",
    quantity: line.quantity ?? 0,
    unitPrice: line.unitPrice ?? 0,
    lineAmount: line.amountExcludingTax ?? 0,
    shippedQuantity,
    // Invoiced quantities are returned from their invoice lines, so only shipped-not-invoiced remains here.
    returnableQuantity: Math.max(0, shippedQuantity - (line.invoicedQuantity ?? 0)),
    reservations,
    ...variantCodeOf(line),
  };
}

function mapSalesInvoiceLine(line: BCSalesInvoiceLineRaw): BCOrderLine {
  return {
    id: line.id,
    sequence: line.sequence,
    lineType: line.lineType ?? "",
    itemId: line.itemId,
    itemNumber: line.item?.number,
    itemDisplayName: line.item?.displayName,
    description: line.description ?? "",
    quantity: line.quantity ?? 0,
    unitPrice: line.unitPrice ?? 0,
    lineAmount: line.amountExcludingTax ?? 0,
    shippedQuantity: line.quantity ?? 0,
    returnableQuantity: line.quantity ?? 0,
    reservations: [],
    ...variantCodeOf(line),
  };
}

function mapSalesInvoiceToSummary(invoice: BCSalesInvoiceRaw): BCOrderInvoiceSummary {
  return {
    id: invoice.id,
    number: requireBusinessCentralString(invoice.number, "number"),
    invoiceDate: invoice.invoiceDate,
    status: invoice.status,
    totalAmountExcludingTax: invoice.totalAmountExcludingTax ?? 0,
    totalAmountIncludingTax: invoice.totalAmountIncludingTax ?? 0,
  };
}

type BCSalesReturnOrderLineRaw = {
  id: string;
  lineType?: string;
};

type BCSalesReturnOrderRaw = {
  id: string;
  number: unknown;
  documentDate: string;
  status: string;
  salesReturnOrderLines?: BCSalesReturnOrderLineRaw[];
};

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

// A blank BC currency code means the environment's local currency (LCY). Same rule as
// resolveCurrencyCode in workflows/company/utils/resolve-currency-code.ts.
function resolveBCCurrencyCode(
  value: unknown,
  environment: BusinessCentralEnvironment
): string {
  const currencyCode = optionalString(value).trim();

  if (currencyCode) {
    return currencyCode;
  }

  return getBusinessCentralLocalCurrency(environment);
}

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

function mapSalesReturnOrderToDetail(
  raw: BCSalesReturnOrderDetailRaw,
  environment: BusinessCentralEnvironment
): BCReturnDetail {
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
    state: "open",
    source: "return_order",
    lines: rawLines
      // BC text lines (blank line type, e.g. "Invoice No. ...:") carry no item or quantity.
      .filter((line) => decodeBCEnumValue(line.lineType).trim() !== "")
      .map(mapSalesReturnOrderDetailLine),
    expectedCredit: {
      currencyCode: resolveBCCurrencyCode(raw.currencyCode, environment),
      amountIncludingTax: roundCurrencyAmount(amountIncludingTax),
      // lineAmount already includes VAT when prices include VAT, so no net figure can be derived.
      amountExcludingTax:
        raw.pricesIncludingVAT === true ? null : roundCurrencyAmount(lineAmount),
    },
    receipts: [],
  };
}

class BusinessCentralModuleService implements IBusinessCentralModuleService {
  private readonly logger?: Logger;
  // The company name for ODataV4 shipment reads is kept with the token, so it is read once per
  // token lifetime. Kept per environment, so a token or company name never crosses environments.
  private readonly shipmentReadTokens = new Map<
    BusinessCentralEnvironment,
    { accessToken: string; renewAtMs: number; companyName: string | null }
  >();

  constructor({ logger }: { logger?: Logger } = {}) {
    this.logger = logger;
  }

  private getClientCredentials(): { clientId: string; clientSecret: string } {
    const clientId = process.env.BUSINESS_CENTRAL_CLIENT_ID;
    const clientSecret = process.env.BUSINESS_CENTRAL_CLIENT_SECRET;

    if (!clientId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "BUSINESS_CENTRAL_CLIENT_ID is required"
      );
    }

    if (!clientSecret) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "BUSINESS_CENTRAL_CLIENT_SECRET is required"
      );
    }

    if (!AZURE_GUID_PATTERN.test(clientId)) {
      const swappedCredentialsHint = AZURE_GUID_PATTERN.test(clientSecret)
        ? " BUSINESS_CENTRAL_CLIENT_SECRET looks like a GUID, so the two values may be swapped."
        : "";

      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `BUSINESS_CENTRAL_CLIENT_ID must be the Azure application client ID GUID.${swappedCredentialsHint}`
      );
    }

    return { clientId, clientSecret };
  }

  private async getCompanyName(
    discoveryUrl: URL,
    accessToken: string,
    companyId: string
  ): Promise<string> {
    let companyResponse: Response;

    try {
      companyResponse = await fetch(
        `${discoveryUrl.toString()}/companies(${companyId})`,
        {
          method: "GET",
          headers: {
            authorization: `Bearer ${accessToken}`,
            accept: "application/json",
          },
        }
      );
    } catch {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Business Central company request failed"
      );
    }

    if (!companyResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central company request failed with status ${companyResponse.status}`
      );
    }

    const companyBody = (await companyResponse.json()) as { name?: unknown };

    return requireBusinessCentralString(companyBody.name, "name");
  }

  private async listOrderReservations(
    endpoint: BusinessCentralEndpoint,
    accessToken: string,
    orderNumber: string
  ): Promise<BCItemReservation[]> {
    const reservationsUrl = new URL(
      `${endpoint.environmentBaseUrl}/${CUSTOMER_PORTAL_API_PATH}/companies(${getBusinessCentralCompanyId(endpoint.environment)})/salesOrderReservationEntries`
    );
    reservationsUrl.searchParams.set(
      "$filter",
      `documentNumber eq '${escapeODataString(orderNumber)}'`
    );

    const reservationsResponse = await fetch(reservationsUrl.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });

    if (!reservationsResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central reservations request failed with status ${reservationsResponse.status}`
      );
    }

    const reservationsBody = (await reservationsResponse.json()) as {
      value?: BCReservationEntryRaw[];
    };
    const itemReservations: BCItemReservation[] = [];

    for (const raw of reservationsBody.value ?? []) {
      // Tracking, Surplus and Prospect entries are BC order-tracking internals, not reservations.
      if (
        raw.reservationStatus !== "Reservation" ||
        typeof raw.itemNumber !== "string" ||
        typeof raw.quantityBase !== "number"
      ) {
        continue;
      }

      itemReservations.push({
        itemNumber: raw.itemNumber,
        variantCode: optionalString(raw.variantCode),
        reservation: {
          id: optionalString(raw.id),
          // Guard against the demand side of a reservation, which BC stores as a negative quantity.
          quantity: Math.abs(raw.quantityBase),
          reservedFrom: optionalString(raw.reservedFrom),
          locationCode: optionalString(raw.locationCode),
          freightType: optionalString(raw.freightType),
          expectedReceiptDate: optionalDate(raw.expectedReceiptDate),
          shipmentDate: optionalDate(raw.shipmentDate),
        },
      });
    }

    return itemReservations;
  }

  private async getODataV4Url(
    endpoint: BusinessCentralEndpoint,
    accessToken: string,
    resource: string
  ): Promise<URL> {
    const companyName = await this.getCompanyName(
      endpoint.discoveryUrl,
      accessToken,
      getBusinessCentralCompanyId(endpoint.environment)
    );
    const url = new URL(`${endpoint.environmentBaseUrl}/ODataV4/${resource}`);
    url.searchParams.set("company", `'${escapeODataString(companyName)}'`);

    return url;
  }

  private async getTokenErrorMessage(tokenResponse: Response): Promise<string> {
    const responseText = await tokenResponse.text();

    if (!responseText) {
      return `Business Central token request failed with status ${tokenResponse.status}`;
    }

    try {
      const errorBody = JSON.parse(
        responseText
      ) as BusinessCentralTokenErrorResponse;

      if (errorBody.error_description) {
        return `Business Central token request failed: ${errorBody.error_description}`;
      }

      if (errorBody.error) {
        return `Business Central token request failed: ${errorBody.error}`;
      }
    } catch {
      // Fall back to the raw response text below.
    }

    return `Business Central token request failed with status ${tokenResponse.status}: ${responseText}`;
  }

  private async requestToken(
    tenantId: string,
    clientId: string,
    clientSecret: string
  ): Promise<string> {
    return (await this.requestTokenWithLifetime(tenantId, clientId, clientSecret)).accessToken;
  }

  private async requestTokenWithLifetime(
    tenantId: string,
    clientId: string,
    clientSecret: string,
    signal?: AbortSignal,
    deadlineMs?: number
  ): Promise<{ accessToken: string; expiresInSeconds: number | null }> {
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const tokenRequest = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      scope: BUSINESS_CENTRAL_SCOPE,
    });

    let tokenResponse: Response;

    if (deadlineMs !== undefined && Date.now() >= deadlineMs) {
      throw new ShipmentReadDeadlineError();
    }

    try {
      tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: tokenRequest.toString(),
        signal,
      });
    } catch {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Business Central token request failed"
      );
    }

    if (!tokenResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        await this.getTokenErrorMessage(tokenResponse)
      );
    }

    const tokenBody =
      (await tokenResponse.json()) as Partial<BusinessCentralTokenResponse>;
    const accessToken = tokenBody.access_token;

    if (!accessToken) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Business Central token response did not include access_token"
      );
    }

    return {
      accessToken,
      expiresInSeconds:
        typeof tokenBody.expires_in === "number" && Number.isFinite(tokenBody.expires_in)
          ? tokenBody.expires_in
          : null,
    };
  }

  // Shared by the shipment reads only, so a polling run asks for one token, not one per call.
  private async getShipmentReadToken(
    endpoint: BusinessCentralEndpoint,
    deadlineMs?: number
  ): Promise<string> {
    const cached = this.shipmentReadTokens.get(endpoint.environment);

    if (cached && Date.now() < cached.renewAtMs) {
      return cached.accessToken;
    }

    const { clientId, clientSecret } = this.getClientCredentials();
    const { accessToken, expiresInSeconds } = await this.requestTokenWithLifetime(
      endpoint.tenantId,
      clientId,
      clientSecret,
      AbortSignal.timeout(SHIPMENT_REQUEST_TIMEOUT_MS),
      deadlineMs
    );

    // Without a lifetime the token is used for this call only.
    if (expiresInSeconds === null) {
      this.shipmentReadTokens.delete(endpoint.environment);
    } else {
      this.shipmentReadTokens.set(endpoint.environment, {
        accessToken,
        renewAtMs: Date.now() + expiresInSeconds * 1000 - SHIPMENT_TOKEN_RENEW_BEFORE_MS,
        companyName: null,
      });
    }

    return accessToken;
  }

  private async getShipmentJson<TBody = ShipmentPageBody<BCSalesShipmentRaw>>(
    url: string,
    accessToken: string,
    deadlineMs?: number
  ): Promise<TBody> {
    let response: Response;

    if (deadlineMs !== undefined && Date.now() >= deadlineMs) {
      throw new ShipmentReadDeadlineError();
    }

    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/json",
          prefer: `odata.maxpagesize=${SHIPMENT_PAGE_SIZE}`,
        },
        signal: AbortSignal.timeout(SHIPMENT_REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Business Central shipment request did not complete"
      );
    }

    if (isThrottlingStatus(response.status)) {
      throw new BusinessCentralThrottledError(
        `Business Central throttled the shipment request with status ${response.status}`,
        parseRetryAfterSeconds(response.headers.get("retry-after"), Date.now())
      );
    }

    if (!response.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central shipment request failed with status ${response.status}`
      );
    }

    try {
      return (await response.json()) as TBody;
    } catch {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Malformed Business Central shipment response"
      );
    }
  }

  // Follows @odata.nextLink to the end, so a window is read completely or not at all.
  private async getAllShipmentPages<TRow = BCSalesShipmentRaw>(
    firstUrl: URL,
    discoveryUrl: URL,
    accessToken: string,
    deadlineMs?: number
  ): Promise<TRow[]> {
    const rows: TRow[] = [];
    let nextUrl: string | null = firstUrl.toString();

    while (nextUrl !== null) {
      const body = await this.getShipmentJson<ShipmentPageBody<TRow>>(nextUrl, accessToken, deadlineMs);
      rows.push(...(body.value ?? []));
      nextUrl = this.resolveShipmentNextLink(body["@odata.nextLink"], discoveryUrl);
    }

    return rows;
  }

  // The bearer token is only ever sent to the configured Business Central origin.
  private resolveShipmentNextLink(nextLink: unknown, discoveryUrl: URL): string | null {
    if (nextLink === undefined || nextLink === null) {
      return null;
    }

    let url: URL | null = null;

    try {
      url = typeof nextLink === "string" ? new URL(nextLink, discoveryUrl) : null;
    } catch {
      url = null;
    }

    if (url === null || url.origin !== discoveryUrl.origin) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Business Central shipment nextLink is not a Business Central URL"
      );
    }

    return url.toString();
  }

  async countShipments(
    environment: BusinessCentralEnvironment,
    window: BCShipmentWindow,
    deadlineMs?: number
  ): Promise<number> {
    const endpoint = getBusinessCentralEndpoint(environment);
    const { discoveryUrl } = endpoint;
    const accessToken = await this.getShipmentReadToken(endpoint, deadlineMs);
    const url = new URL(`${discoveryUrl.toString()}/salesShipments`);
    url.searchParams.set("$filter", buildShipmentWindowFilter(window));
    url.searchParams.set("$count", "true");
    url.searchParams.set("$top", "1");
    url.searchParams.set("$select", "id");

    const count = (await this.getShipmentJson(url.toString(), accessToken, deadlineMs))["@odata.count"];

    if (typeof count !== "number" || !Number.isInteger(count)) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Business Central shipment response did not include a count"
      );
    }

    return count;
  }

  async listShipmentHeaders(
    environment: BusinessCentralEnvironment,
    window: BCShipmentWindow,
    deadlineMs?: number
  ): Promise<BCShipmentHeader[]> {
    const endpoint = getBusinessCentralEndpoint(environment);
    const { discoveryUrl } = endpoint;
    const accessToken = await this.getShipmentReadToken(endpoint, deadlineMs);
    const url = new URL(`${discoveryUrl.toString()}/salesShipments`);
    url.searchParams.set("$filter", buildShipmentWindowFilter(window));
    url.searchParams.set("$orderby", "lastModifiedDateTime asc");
    url.searchParams.set("$select", SHIPMENT_HEADER_FIELDS);

    const rows = await this.getAllShipmentPages(url, discoveryUrl, accessToken, deadlineMs);

    return rows.map(mapShipmentHeader);
  }

  async getShipmentsByNumbers(
    environment: BusinessCentralEnvironment,
    numbers: readonly string[],
    deadlineMs?: number
  ): Promise<BCShipment[]> {
    const chunks = chunkShipmentNumbers(numbers);

    if (chunks.length === 0) {
      return [];
    }

    const endpoint = getBusinessCentralEndpoint(environment);
    const { discoveryUrl } = endpoint;
    const accessToken = await this.getShipmentReadToken(endpoint, deadlineMs);
    const shipments: BCShipment[] = [];

    // One request at a time keeps the polling run's load on BC predictable.
    for (const chunk of chunks) {
      const url = new URL(`${discoveryUrl.toString()}/salesShipments`);
      url.searchParams.set("$filter", buildShipmentNumberFilter(chunk));
      url.searchParams.set("$select", SHIPMENT_DETAIL_FIELDS);
      url.searchParams.set("$expand", `salesShipmentLines($select=${SHIPMENT_LINE_FIELDS})`);

      const rows = await this.getAllShipmentPages(url, discoveryUrl, accessToken, deadlineMs);
      shipments.push(...rows.map(mapShipment));
    }

    return shipments;
  }

  // Read through the shipment request path (timeout, deadline, throttling), unlike getCompanyName.
  private async getShipmentReadCompanyName(
    endpoint: BusinessCentralEndpoint,
    accessToken: string,
    deadlineMs?: number
  ): Promise<string> {
    const cached = this.shipmentReadTokens.get(endpoint.environment);

    if (cached?.accessToken === accessToken && cached.companyName !== null) {
      return cached.companyName;
    }

    const body = await this.getShipmentJson<{ name?: unknown }>(
      `${endpoint.discoveryUrl.toString()}/companies(${getBusinessCentralCompanyId(endpoint.environment)})`,
      accessToken,
      deadlineMs
    );
    const companyName = requireBusinessCentralString(body.name, "name");
    const current = this.shipmentReadTokens.get(endpoint.environment);

    if (current?.accessToken === accessToken) {
      current.companyName = companyName;
    }

    return companyName;
  }

  async getShipmentLineVariants(
    environment: BusinessCentralEnvironment,
    numbers: readonly string[],
    deadlineMs?: number
  ): Promise<BCShipmentLineVariant[]> {
    const chunks = chunkShipmentNumbers(numbers);

    if (chunks.length === 0) {
      return [];
    }

    const endpoint = getBusinessCentralEndpoint(environment);
    const { discoveryUrl } = endpoint;
    const accessToken = await this.getShipmentReadToken(endpoint, deadlineMs);
    const companyName = await this.getShipmentReadCompanyName(endpoint, accessToken, deadlineMs);
    const variants: BCShipmentLineVariant[] = [];

    for (const chunk of chunks) {
      const url = new URL(
        `${endpoint.environmentBaseUrl}/ODataV4/${SHIPMENT_LINE_VARIANT_ENTITY_SET}`
      );
      url.searchParams.set("company", buildODataCompanyParameter(companyName));
      url.searchParams.set("$filter", buildShipmentLineVariantFilter(chunk));
      url.searchParams.set("$select", SHIPMENT_LINE_VARIANT_FIELDS);

      const rows = await this.getAllShipmentPages<BCShipmentLineVariantRaw>(
        url,
        discoveryUrl,
        accessToken,
        deadlineMs
      );
      variants.push(...rows.map(mapShipmentLineVariant));
    }

    return variants;
  }

  // Only the disabled /store/business-central/operations route used this; it stays on DK.
  async getOperations(): Promise<unknown> {
    const { discoveryUrl, tenantId } = getBusinessCentralEndpoint("DK");
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);

    const operationsResponse = await fetch(discoveryUrl.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });

    if (!operationsResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central operations request failed with status ${operationsResponse.status}`
      );
    }

    return operationsResponse.json();
  }

  async getCustomer(
    environment: BusinessCentralEnvironment,
    customerNumber: string
  ): Promise<BCCustomer | null> {
    const endpoint = getBusinessCentralEndpoint(environment);
    const { discoveryUrl, tenantId } = endpoint;
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);

    const customersUrl = new URL(`${discoveryUrl.toString()}/customers()`);
    customersUrl.searchParams.set(
      "$filter",
      `number eq '${escapeODataString(customerNumber)}'`
    );
    customersUrl.searchParams.set("$top", "1");
    customersUrl.searchParams.set("$expand", "currency");

    let customersResponse: Response;

    try {
      customersResponse = await fetch(customersUrl.toString(), {
        method: "GET",
        headers: {
          authorization: ["Bearer", accessToken].join(" "),
          accept: "application/json",
        },
      });
    } catch {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Business Central customer request failed"
      );
    }

    if (!customersResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central customer request failed with status ${customersResponse.status}`
      );
    }

    type BCCustomerRaw = {
      number?: unknown;
      displayName?: unknown;
      email?: unknown;
      phoneNumber?: unknown;
      addressLine1?: unknown;
      addressLine2?: unknown;
      city?: unknown;
      state?: unknown;
      postalCode?: unknown;
      country?: unknown;
      blocked?: unknown;
      creditLimit?: unknown;
      taxRegistrationNumber?: unknown;
      currency?: { code?: unknown } | null;
    };

    let body: { value?: BCCustomerRaw[] };

    try {
      body = (await customersResponse.json()) as {
        value?: BCCustomerRaw[];
      };
    } catch {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Malformed Business Central customer response"
      );
    }
    const raw = body.value?.[0];

    if (!raw) {
      return null;
    }

    return {
      number: optionalString(raw.number),
      displayName: optionalString(raw.displayName),
      email: optionalString(raw.email),
      phoneNumber: optionalString(raw.phoneNumber),
      addressLine1: optionalString(raw.addressLine1),
      addressLine2: optionalString(raw.addressLine2),
      city: optionalString(raw.city),
      state: optionalString(raw.state),
      postalCode: optionalString(raw.postalCode),
      country: optionalString(raw.country),
      blocked: normalizeBlockedState(raw.blocked),
      creditLimit: parseCreditLimit(raw.creditLimit),
      taxRegistrationNumber: optionalString(raw.taxRegistrationNumber),
      currencyCode:
        typeof raw.currency?.code === "string" ? raw.currency.code : null,
    };
  }

  // Reads every chunk one request at a time, so an order's load on BC stays predictable. A page
  // with a next link is never taken as the whole answer.
  private async fetchItemLookupRows<TRaw>(
    baseUrl: URL,
    accessToken: string,
    filterField: string,
    values: readonly string[],
    configure: (url: URL) => void,
    label: string
  ): Promise<TRaw[]> {
    const rows: TRaw[] = [];

    for (const chunk of chunkLookupValues(values)) {
      const url = new URL(baseUrl.toString());
      url.searchParams.set(
        "$filter",
        chunk.map((value) => `${filterField} eq '${escapeODataString(value)}'`).join(" or ")
      );
      configure(url);

      let response: Response;

      try {
        response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            authorization: `Bearer ${accessToken}`,
            accept: "application/json",
          },
        });
      } catch {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `Business Central ${label} request did not complete`
        );
      }

      if (!response.ok) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `Business Central ${label} request failed with status ${response.status}`
        );
      }

      let body: { value?: TRaw[]; "@odata.nextLink"?: unknown };

      try {
        body = (await response.json()) as { value?: TRaw[]; "@odata.nextLink"?: unknown };
      } catch {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `Malformed Business Central ${label} response`
        );
      }

      if (body["@odata.nextLink"] !== undefined && body["@odata.nextLink"] !== null) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `Business Central ${label} response was incomplete`
        );
      }

      rows.push(...(body.value ?? []));
    }

    return rows;
  }

  async getItemLookupEvidence(
    environment: BusinessCentralEnvironment,
    lines: BCItemLookupInput[]
  ): Promise<BCItemLookupEvidence> {
    const barcodes = collectLineBarcodes(lines);
    const lineItemNumbers = collectItemNumbers(lines, []);

    if (barcodes.length === 0 && lineItemNumbers.length === 0) {
      return { itemsByBarcode: [], barcodeReferences: [], itemsByNumber: [] };
    }

    const endpoint = getBusinessCentralEndpoint(environment);
    const { discoveryUrl, tenantId } = endpoint;
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);
    const itemsUrl = new URL(`${discoveryUrl.toString()}/items()`);
    const configureItems = (url: URL): void => {
      url.searchParams.set("$select", ITEM_LOOKUP_SELECT);
      url.searchParams.set("$expand", ITEM_LOOKUP_EXPAND);
    };

    let itemsByBarcode: BCItem[] = [];
    let barcodeReferences: BCItemBarcodeReference[] = [];

    if (barcodes.length > 0) {
      itemsByBarcode = (
        await this.fetchItemLookupRows<BCItemLookupItemRaw>(
          itemsUrl,
          accessToken,
          "gtin",
          barcodes,
          configureItems,
          "item"
        )
      ).map(mapLookupItem);

      const referencesUrl = await this.getODataV4Url(
        endpoint,
        accessToken,
        ITEM_REFERENCE_ENTITY_SET
      );
      barcodeReferences = (
        await this.fetchItemLookupRows<BCItemReferenceRaw>(
          referencesUrl,
          accessToken,
          "Reference_No",
          barcodes,
          (url) => url.searchParams.set("$select", ITEM_REFERENCE_FIELDS),
          "item reference"
        )
      ).map(mapItemBarcodeReference);
    }

    const itemsByNumber = (
      await this.fetchItemLookupRows<BCItemLookupItemRaw>(
        itemsUrl,
        accessToken,
        "number",
        collectItemNumbers(lines, barcodeReferences),
        configureItems,
        "item"
      )
    ).map(mapLookupItem);

    return { itemsByBarcode, barcodeReferences, itemsByNumber };
  }

  private async postSalesOrderLine(
    discoveryUrl: URL,
    accessToken: string,
    salesOrderId: string,
    line: BCCreateSalesOrderLineInput
  ): Promise<
    | { accepted: true; line: BCAcceptedSalesOrderLine }
    | { accepted: false; rejection: BCSalesOrderLineRejection }
  > {
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
        accepted: false,
        rejection: {
          lineNumber: line.lineNumber,
          message: "Business Central sales order line request did not complete",
        },
      };
    }

    if (!lineResponse.ok) {
      return {
        accepted: false,
        rejection: {
          lineNumber: line.lineNumber,
          message: `Business Central rejected the sales order line with status ${lineResponse.status}`,
        },
      };
    }

    // BC already created the line, so an unreadable body only loses its line number.
    let sequence: unknown;

    try {
      sequence = ((await lineResponse.json()) as { sequence?: unknown } | null)?.sequence;
    } catch {
      sequence = undefined;
    }

    return {
      accepted: true,
      line: {
        lineNumber: line.lineNumber,
        sequence:
          typeof sequence === "number" && Number.isInteger(sequence) ? sequence : null,
      },
    };
  }

  async createSalesOrder(
    environment: BusinessCentralEnvironment,
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

    const endpoint = getBusinessCentralEndpoint(environment);
    const { discoveryUrl, tenantId } = endpoint;
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
    const acceptedLines: BCAcceptedSalesOrderLine[] = [];
    const rejectedLines: BCSalesOrderLineRejection[] = [];

    for (const line of params.lines) {
      const result = await this.postSalesOrderLine(
        discoveryUrl,
        accessToken,
        salesOrderId,
        line
      );

      if (!result.accepted) {
        rejectedLines.push(result.rejection);
        continue;
      }

      acceptedLines.push(result.line);
    }

    return {
      id: salesOrderId,
      number: optionalString(created.number),
      status: optionalString(created.status),
      acceptedLineNumbers: acceptedLines.map((line) => line.lineNumber),
      acceptedLines,
      rejectedLines,
    };
  }

  async createReturnFromSalesOrder(
    environment: BusinessCentralEnvironment,
    params: BCCreateReturnParams
  ): Promise<BCReturnOrder> {
    if (!params.requestId || !params.sourceOrderNo || params.lines.length === 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A return request must include an ID, source order, and at least one line."
      );
    }

    for (const line of params.lines) {
      if (line.quantityToReturn <= 0 || !line.returnReasonCode) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Each return line must have a positive quantity and return reason."
        );
      }
    }

    const endpoint = getBusinessCentralEndpoint(environment);
    const { discoveryUrl, tenantId } = endpoint;
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);
    const actionUrl = await this.getODataV4Url(
      endpoint,
      accessToken,
      CREATE_RETURN_ORDER_ACTION
    );
    const lines = params.lines.map((line) => ({
      sourceLineNo: line.sourceLineNo,
      quantityToReturn: line.quantityToReturn,
      returnReasonCode: line.returnReasonCode,
    }));

    const requestBody = JSON.stringify({
      requestId: params.requestId,
      sourceOrderNo: params.sourceOrderNo,
      lines: JSON.stringify(lines),
    });

    let actionResponse: Response;

    try {
      actionResponse = await fetch(actionUrl.toString(), {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: requestBody,
        signal: AbortSignal.timeout(CREATE_RETURN_TIMEOUT_MS),
      });
    } catch {
      throw new BusinessCentralAmbiguousOutcomeError(
        "Business Central return request did not complete",
        params.requestId
      );
    }

    const responseText = await actionResponse.text().catch(() => "");

    if (actionResponse.status >= 500 || actionResponse.status === 408) {
      throw new BusinessCentralAmbiguousOutcomeError(
        `Business Central return request failed with status ${actionResponse.status}`,
        params.requestId
      );
    }

    if (actionResponse.status === 401 || actionResponse.status === 403) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central return request failed with status ${actionResponse.status}`
      );
    }

    if (!actionResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "The return request could not be accepted. Please check the selected lines and try again."
      );
    }

    let returnOrderNo: unknown;

    try {
      returnOrderNo = (JSON.parse(responseText) as { value?: unknown }).value;
    } catch {
      returnOrderNo = undefined;
    }

    if (typeof returnOrderNo !== "string" || returnOrderNo.trim() === "") {
      throw new BusinessCentralAmbiguousOutcomeError(
        "Business Central return response did not include a return order",
        params.requestId
      );
    }

    return {
      id: returnOrderNo.trim(),
      number: returnOrderNo.trim(),
      status: "Open",
      requestId: params.requestId,
      sourceOrderNo: params.sourceOrderNo,
      lines,
    };
  }

  async listReturnReasons(environment: BusinessCentralEnvironment): Promise<BCReturnReason[]> {
    const endpoint = getBusinessCentralEndpoint(environment);
    const { discoveryUrl, tenantId } = endpoint;
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);
    const reasonsUrl = await this.getODataV4Url(
      endpoint,
      accessToken,
      ENABLED_REASON_CODES_ENTITY_SET
    );
    reasonsUrl.searchParams.set("$select", "ReasonCode,Description");

    let reasonsResponse: Response;

    try {
      reasonsResponse = await fetch(reasonsUrl.toString(), {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/json",
        },
      });
    } catch {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Business Central return reasons request failed"
      );
    }

    if (!reasonsResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central return reasons request failed with status ${reasonsResponse.status}`
      );
    }

    const reasonsBody = (await reasonsResponse.json()) as {
      value?: Array<{ ReasonCode?: unknown; Description?: unknown }>;
    };
    const reasons = new Map<string, BCReturnReason>();

    for (const raw of reasonsBody.value ?? []) {
      if (typeof raw.ReasonCode !== "string" || raw.ReasonCode === "") {
        continue;
      }

      if (!reasons.has(raw.ReasonCode)) {
        reasons.set(raw.ReasonCode, {
          id: raw.ReasonCode,
          description: optionalString(raw.Description) || raw.ReasonCode,
        });
      }
    }

    return [...reasons.values()];
  }

  // Merges open return orders (v2.0 salesReturnOrders) with posted return receipts (ODataV4
  // PostedReturnReceipt), both filtered on the session's customer number. salesReturnOrder has
  // no customerId, so no customer-GUID lookup is needed (contrast with listOrders). BC cannot
  // page across two sources, so both are read up to a cap and merged, filtered, sorted and
  // paged in memory (NIMBUS-172).
  async listReturns(
    environment: BusinessCentralEnvironment,
    params: BCListReturnsParams
  ): Promise<BCListReturnsResult> {
    const endpoint = getBusinessCentralEndpoint(environment);
    const { discoveryUrl, tenantId } = endpoint;
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);

    const receiptsUrlPromise = this.getODataV4Url(
      endpoint,
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
    // Newest first, so hitting the cap drops the oldest open return orders.
    odataUrl.searchParams.set("$orderby", "documentDate desc");
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
    // Newest first, so hitting $top drops the oldest receipts.
    url.searchParams.set("$orderby", "Document_Date desc");

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

  private async getCustomerId(
    discoveryUrl: URL,
    accessToken: string,
    customerNumber: string
  ): Promise<string | null> {
    const customersUrl = new URL(`${discoveryUrl.toString()}/customers()`);
    customersUrl.searchParams.set(
      "$filter",
      `number eq '${escapeODataString(customerNumber)}'`
    );
    customersUrl.searchParams.set("$top", "1");

    const customersResponse = await fetch(customersUrl.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });

    if (!customersResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central customer request failed with status ${customersResponse.status}`
      );
    }

    const customersBody = (await customersResponse.json()) as {
      value?: Array<{ id?: string }>;
    };
    const customerId = customersBody.value?.[0]?.id;

    return customerId ?? null;
  }

  private async fetchAllSalesOrderNumbers(
    discoveryUrl: URL,
    accessToken: string,
    orderFilters: string[]
  ): Promise<Set<string>> {
    const url = new URL(`${discoveryUrl.toString()}/salesOrders()`);
    url.searchParams.set("$filter", orderFilters.join(" and "));
    url.searchParams.set("$top", String(SALES_ORDER_DEDUP_FETCH_CAP));

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
        `Business Central orders request failed with status ${response.status}`
      );
    }

    const body = (await response.json()) as {
      value?: Array<{ number?: unknown }>;
    };
    const numbers = new Set<string>();

    for (const item of body.value ?? []) {
      if (typeof item.number === "string" && item.number.length > 0) {
        numbers.add(item.number);
      }
    }

    return numbers;
  }

  private async fetchSalesInvoicesBatch(
    discoveryUrl: URL,
    accessToken: string,
    invoiceFilters: string[],
    top: number,
    skip: number
  ): Promise<BCSalesInvoiceRaw[]> {
    const url = new URL(`${discoveryUrl.toString()}/salesInvoices()`);
    url.searchParams.set("$filter", invoiceFilters.join(" and "));
    url.searchParams.set("$top", String(top));
    url.searchParams.set("$skip", String(skip));
    url.searchParams.set("$orderby", "invoiceDate desc");

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
        `Business Central invoices request failed with status ${response.status}`
      );
    }

    const body = (await response.json()) as { value?: BCSalesInvoiceRaw[] };
    return body.value ?? [];
  }

  async listOrders(
    environment: BusinessCentralEnvironment,
    params: BCListOrdersParams
  ): Promise<BCListOrdersResult> {
    const endpoint = getBusinessCentralEndpoint(environment);
    const { discoveryUrl, tenantId } = endpoint;
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);
    const customerId = await this.getCustomerId(
      discoveryUrl,
      accessToken,
      params.customerNumber
    );

    if (!customerId) {
      return {
        orders: [],
        count: 0,
        offset: params.offset,
        limit: params.limit,
      };
    }

    const orderFilters: string[] = [`customerId eq ${escapeODataString(customerId)}`];
    if (params.status) {
      orderFilters.push(`status eq '${escapeODataString(params.status)}'`);
    }
    if (params.date_from) {
      orderFilters.push(`orderDate ge ${params.date_from}`);
    }
    if (params.date_to) {
      orderFilters.push(`orderDate le ${params.date_to}`);
    }
    if (params.search) {
      orderFilters.push(`contains(number,'${escapeODataString(params.search)}')`);
    }

    const invoiceFilters: string[] = [`customerId eq ${escapeODataString(customerId)}`];
    if (params.status) {
      invoiceFilters.push(`status eq '${escapeODataString(params.status)}'`);
    }
    if (params.date_from) {
      invoiceFilters.push(`invoiceDate ge ${params.date_from}`);
    }
    if (params.date_to) {
      invoiceFilters.push(`invoiceDate le ${params.date_to}`);
    }
    if (params.search) {
      invoiceFilters.push(`contains(orderNumber,'${escapeODataString(params.search)}')`);
    }

    const odataUrl = new URL(`${discoveryUrl.toString()}/salesOrders()`);
    odataUrl.searchParams.set("$filter", orderFilters.join(" and "));
    odataUrl.searchParams.set("$top", String(params.limit));
    odataUrl.searchParams.set("$skip", String(params.offset));
    odataUrl.searchParams.set("$count", "true");
    odataUrl.searchParams.set("$orderby", "orderDate desc");

    const ordersResponse = await fetch(odataUrl.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });

    if (!ordersResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central orders request failed with status ${ordersResponse.status}`
      );
    }

    const ordersBody = (await ordersResponse.json()) as {
      "@odata.count"?: number;
      value: BCSalesOrderRaw[];
    };
    const salesOrdersTotal = ordersBody["@odata.count"] ?? 0;
    const orders: BCOrder[] = (ordersBody.value ?? []).map(mapSalesOrderToBCOrder);

    const invoicesCountUrl = new URL(`${discoveryUrl.toString()}/salesInvoices()`);
    invoicesCountUrl.searchParams.set("$filter", invoiceFilters.join(" and "));
    invoicesCountUrl.searchParams.set("$top", "1");
    invoicesCountUrl.searchParams.set("$count", "true");

    const invoicesCountResponse = await fetch(invoicesCountUrl.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });

    if (!invoicesCountResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central invoices request failed with status ${invoicesCountResponse.status}`
      );
    }

    const invoicesCountBody = (await invoicesCountResponse.json()) as {
      "@odata.count"?: number;
    };
    const invoicesRawCountApprox = invoicesCountBody["@odata.count"] ?? 0;

    const remainder = params.limit - orders.length;
    let invoiceOnlyOrders: BCOrder[] = [];

    if (remainder > 0) {
      const dedupOrderNumbers = await this.fetchAllSalesOrderNumbers(
        discoveryUrl,
        accessToken,
        orderFilters
      );

      const skipPastInvoiceOnly = Math.max(0, params.offset - salesOrdersTotal);
      const seenInvoiceOrderNumbers = new Set<string>();
      const collected: BCOrder[] = [];
      let skippedSoFar = 0;
      let rawInvoiceSkip = 0;
      let roundTrips = 0;

      while (
        collected.length < remainder &&
        roundTrips < MAX_INVOICE_FILL_ROUND_TRIPS
      ) {
        const batch = await this.fetchSalesInvoicesBatch(
          discoveryUrl,
          accessToken,
          invoiceFilters,
          INVOICE_FILL_BATCH_SIZE,
          rawInvoiceSkip
        );
        roundTrips += 1;

        if (batch.length === 0) {
          break;
        }

        for (const raw of batch) {
          if (typeof raw.orderNumber !== "string" || raw.orderNumber.length === 0) {
            continue;
          }
          if (dedupOrderNumbers.has(raw.orderNumber)) {
            continue;
          }
          if (seenInvoiceOrderNumbers.has(raw.orderNumber)) {
            continue;
          }
          seenInvoiceOrderNumbers.add(raw.orderNumber);

          if (skippedSoFar < skipPastInvoiceOnly) {
            skippedSoFar += 1;
            continue;
          }

          collected.push(mapSalesInvoiceToBCOrder(raw));
          if (collected.length === remainder) {
            break;
          }
        }

        rawInvoiceSkip += batch.length;
        if (batch.length < INVOICE_FILL_BATCH_SIZE) {
          break;
        }
      }

      invoiceOnlyOrders = collected;
    }

    return {
      orders: [...orders, ...invoiceOnlyOrders],
      count: salesOrdersTotal + invoicesRawCountApprox,
      offset: params.offset,
      limit: params.limit,
    };
  }

  async getOrder(
    environment: BusinessCentralEnvironment,
    params: BCGetOrderParams
  ): Promise<BCOrderDetail | null> {
    const endpoint = getBusinessCentralEndpoint(environment);
    const { discoveryUrl, tenantId } = endpoint;
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);
    const customerId = await this.getCustomerId(
      discoveryUrl,
      accessToken,
      params.customerNumber
    );

    if (!customerId) {
      return null;
    }

    const orderUrl = new URL(`${discoveryUrl.toString()}/salesOrders()`);
    orderUrl.searchParams.set(
      "$filter",
      [
        `customerId eq ${escapeODataString(customerId)}`,
        `number eq '${escapeODataString(params.orderNumber)}'`,
      ].join(" and ")
    );
    orderUrl.searchParams.set("$top", "1");
    orderUrl.searchParams.set("$expand", "salesOrderLines($expand=item,itemVariant)");

    const invoicesUrl = new URL(`${discoveryUrl.toString()}/salesInvoices()`);
    invoicesUrl.searchParams.set(
      "$filter",
      [
        `customerId eq ${escapeODataString(customerId)}`,
        `orderNumber eq '${escapeODataString(params.orderNumber)}'`,
      ].join(" and ")
    );
    invoicesUrl.searchParams.set("$top", String(MAX_ORDER_DETAIL_INVOICES));
    invoicesUrl.searchParams.set("$orderby", "invoiceDate asc");
    invoicesUrl.searchParams.set("$expand", "salesInvoiceLines($expand=item,itemVariant)");

    const [orderResponse, invoicesResponse, itemReservations] = await Promise.all([
      fetch(orderUrl.toString(), {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/json",
        },
      }),
      fetch(invoicesUrl.toString(), {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/json",
        },
      }),
      // Reservations are supplementary; the order must still load when they cannot be fetched.
      this.listOrderReservations(endpoint, accessToken, params.orderNumber).catch(
        (error: unknown) => {
          this.logger?.warn(
            `Business Central reservations could not be loaded: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          return [];
        }
      ),
    ]);

    if (!orderResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central order request failed with status ${orderResponse.status}`
      );
    }

    if (!invoicesResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central invoices request failed with status ${invoicesResponse.status}`
      );
    }

    type BCSalesOrderWithLinesRaw = BCSalesOrderRaw & {
      salesOrderLines?: BCSalesOrderLineRaw[];
    };
    type BCSalesInvoiceWithLinesRaw = BCSalesInvoiceRaw & {
      salesInvoiceLines?: BCSalesInvoiceLineRaw[];
    };

    const orderBody = (await orderResponse.json()) as {
      value?: BCSalesOrderWithLinesRaw[];
    };
    const invoicesBody = (await invoicesResponse.json()) as {
      value?: BCSalesInvoiceWithLinesRaw[];
    };

    const order = orderBody.value?.[0];
    const invoices = invoicesBody.value ?? [];

    if (!order && invoices.length === 0) {
      return null;
    }

    if (order) {
      const sortedOrderLines = [...(order.salesOrderLines ?? [])].sort(
        (left, right) => left.sequence - right.sequence
      );
      const reservationsByLineId = allocateReservations(sortedOrderLines, itemReservations);
      const orderLines: BCOrderLine[] = sortedOrderLines.map((line) =>
        mapSalesOrderLine(line, reservationsByLineId.get(line.id))
      );

      const invoiceLines: BCOrderLine[] = invoices.flatMap((invoice) =>
        [...(invoice.salesInvoiceLines ?? [])]
          .sort((left, right) => left.sequence - right.sequence)
          .map(mapSalesInvoiceLine)
      );

      const base = mapSalesOrderToBCOrder(order);

      return {
        ...base,
        invoiceStatus: invoices.length > 0 ? "partially_invoiced" : "open",
        lines: [...orderLines, ...invoiceLines],
        invoices: invoices.map(mapSalesInvoiceToSummary),
      };
    }

    const earliestInvoice = invoices[0];
    const latestInvoice = invoices[invoices.length - 1];
    const base = mapSalesInvoiceToBCOrder(latestInvoice);

    const lines: BCOrderLine[] = invoices.flatMap((invoice) =>
      [...(invoice.salesInvoiceLines ?? [])]
        .sort((left, right) => left.sequence - right.sequence)
        .map(mapSalesInvoiceLine)
    );

    return {
      ...base,
      orderDate: earliestInvoice.invoiceDate,
      totalAmountExcludingTax: invoices.reduce(
        (sum, invoice) => sum + (invoice.totalAmountExcludingTax ?? 0),
        0
      ),
      totalAmountIncludingTax: invoices.reduce(
        (sum, invoice) => sum + (invoice.totalAmountIncludingTax ?? 0),
        0
      ),
      invoiceStatus: "fully_invoiced",
      lines,
      invoices: invoices.map(mapSalesInvoiceToSummary),
    };
  }

  // Open return orders come from the Abakion customer-portal API (unlike v2.0, its lines expose
  // variantCode and returnReasonCode). Posted return receipts come from the ODataV4
  // PostedReturnReceipt web service. Every query is filtered on the session's customer number.
  async getReturn(
    environment: BusinessCentralEnvironment,
    params: BCGetReturnParams
  ): Promise<BCReturnDetail | null> {
    const endpoint = getBusinessCentralEndpoint(environment);
    const { discoveryUrl, tenantId } = endpoint;
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);

    const customerFilter = `Sell_to_Customer_No eq '${escapeODataString(params.customerNumber)}'`;
    const numberLiteral = `'${escapeODataString(params.returnNumber)}'`;
    const receiptsUrlPromise = this.getODataV4Url(
      endpoint,
      accessToken,
      POSTED_RETURN_RECEIPT_ENTITY_SET
    );
    const [openReturn, [returnOrderReceipts, numberedReceipts]] = await Promise.all([
      this.fetchOpenReturnOrderDetail(endpoint, accessToken, params),
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
    endpoint: BusinessCentralEndpoint,
    accessToken: string,
    params: BCGetReturnParams
  ): Promise<BCReturnDetail | null> {
    const returnUrl = new URL(
      `${endpoint.environmentBaseUrl}/${CUSTOMER_PORTAL_API_PATH}/companies(${getBusinessCentralCompanyId(endpoint.environment)})/salesReturnOrders`
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

    return raw ? mapSalesReturnOrderToDetail(raw, endpoint.environment) : null;
  }
}

export default BusinessCentralModuleService;
