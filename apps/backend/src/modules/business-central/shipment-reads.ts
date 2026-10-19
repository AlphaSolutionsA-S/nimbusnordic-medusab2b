import { MedusaError } from "@medusajs/framework/utils";

import type {
  BCShipment,
  BCShipmentHeader,
  BCShipmentLine,
  BCShipmentLineType,
  BCShipmentWindow,
} from "./types";

export const SHIPMENT_REQUEST_TIMEOUT_MS = 20000;
export const SHIPMENT_PAGE_SIZE = 200;
export const SHIPMENT_NUMBERS_PER_REQUEST = 20;
// The shared token is renewed this long before BC says it expires.
export const SHIPMENT_TOKEN_RENEW_BEFORE_MS = 5 * 60 * 1000;

export const SHIPMENT_HEADER_FIELDS =
  "id,number,orderNumber,externalDocumentNumber,customerNumber,postingDate,lastModifiedDateTime";
// Only what a shipment notice carries: no prices, salesperson, phone or e-mail.
export const SHIPMENT_DETAIL_FIELDS = [
  SHIPMENT_HEADER_FIELDS,
  "shipmentMethodCode,customerPurchaseOrderReference,customerName",
  "sellToAddressLine1,sellToAddressLine2,sellToCity,sellToState,sellToPostCode,sellToCountry",
  "billToCustomerNumber,billToName",
  "billToAddressLine1,billToAddressLine2,billToCity,billToState,billToPostCode,billToCountry",
  "shipToName,shipToContact",
  "shipToAddressLine1,shipToAddressLine2,shipToCity,shipToState,shipToPostCode,shipToCountry",
].join(",");
export const SHIPMENT_LINE_FIELDS =
  "sequence,lineType,lineObjectNumber,description,description2,unitOfMeasureCode,quantity,shipmentDate";

const BC_ITEM_LINE_TYPE = "Item";
// BC's blank enum member, XML-encoded.
const BC_BLANK_LINE_TYPE = "_x0020_";
const BC_EMPTY_DATE = "0001-01-01";

// HTTP 429 or 503 from Business Central. retryAfterSeconds is null when BC sent no usable
// Retry-After header.
export class BusinessCentralThrottledError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds: number | null
  ) {
    super(message);
    this.name = "BusinessCentralThrottledError";
  }
}

export function isThrottlingStatus(status: number): boolean {
  return status === 429 || status === 503;
}

// Retry-After is delta-seconds or an HTTP date (RFC 9110 10.2.3).
export function parseRetryAfterSeconds(value: string | null, nowMs: number): number | null {
  if (value === null || value.trim() === "") {
    return null;
  }

  const trimmed = value.trim();

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  const dateMs = Date.parse(trimmed);

  return Number.isNaN(dateMs) ? null : Math.max(0, Math.ceil((dateMs - nowMs) / 1000));
}

export function buildShipmentWindowFilter(window: BCShipmentWindow): string {
  return [
    `lastModifiedDateTime gt ${window.after.toISOString()}`,
    `lastModifiedDateTime le ${window.until.toISOString()}`,
  ].join(" and ");
}

function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

export function buildShipmentNumberFilter(numbers: readonly string[]): string {
  return numbers.map((number) => `number eq '${escapeODataString(number)}'`).join(" or ");
}

export function chunkShipmentNumbers(numbers: readonly string[]): string[][] {
  const unique = [...new Set(numbers.filter((number) => number !== ""))];
  const chunks: string[][] = [];

  for (let index = 0; index < unique.length; index += SHIPMENT_NUMBERS_PER_REQUEST) {
    chunks.push(unique.slice(index, index + SHIPMENT_NUMBERS_PER_REQUEST));
  }

  return chunks;
}

export type BCSalesShipmentLineRaw = {
  sequence?: unknown;
  lineType?: unknown;
  lineObjectNumber?: unknown;
  description?: unknown;
  description2?: unknown;
  unitOfMeasureCode?: unknown;
  quantity?: unknown;
  shipmentDate?: unknown;
};

export type BCSalesShipmentRaw = {
  id?: unknown;
  number?: unknown;
  orderNumber?: unknown;
  externalDocumentNumber?: unknown;
  customerNumber?: unknown;
  postingDate?: unknown;
  lastModifiedDateTime?: unknown;
  shipmentMethodCode?: unknown;
  customerPurchaseOrderReference?: unknown;
  customerName?: unknown;
  sellToAddressLine1?: unknown;
  sellToAddressLine2?: unknown;
  sellToCity?: unknown;
  sellToState?: unknown;
  sellToPostCode?: unknown;
  sellToCountry?: unknown;
  billToCustomerNumber?: unknown;
  billToName?: unknown;
  billToAddressLine1?: unknown;
  billToAddressLine2?: unknown;
  billToCity?: unknown;
  billToState?: unknown;
  billToPostCode?: unknown;
  billToCountry?: unknown;
  shipToName?: unknown;
  shipToContact?: unknown;
  shipToAddressLine1?: unknown;
  shipToAddressLine2?: unknown;
  shipToCity?: unknown;
  shipToState?: unknown;
  shipToPostCode?: unknown;
  shipToCountry?: unknown;
  salesShipmentLines?: BCSalesShipmentLineRaw[];
};

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value === "") {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Business Central shipment field ${fieldName} must be a non-empty string`
    );
  }

  return value;
}

function requireNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Business Central shipment field ${fieldName} must be a number`
    );
  }

  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

// BC sends 0001-01-01 for a date that was never set.
function nullableDate(value: unknown): string | null {
  const date = nullableString(value);

  return date === null || date === BC_EMPTY_DATE ? null : date;
}

export function decodeShipmentLineType(value: unknown): BCShipmentLineType {
  if (value === BC_ITEM_LINE_TYPE) {
    return "item";
  }

  return value === BC_BLANK_LINE_TYPE ? "comment" : "other";
}

export function mapShipmentHeader(raw: BCSalesShipmentRaw): BCShipmentHeader {
  return {
    id: requireString(raw.id, "id"),
    number: requireString(raw.number, "number"),
    orderNumber: nullableString(raw.orderNumber),
    externalDocumentNumber: nullableString(raw.externalDocumentNumber),
    customerNumber: nullableString(raw.customerNumber),
    postingDate: nullableDate(raw.postingDate),
    lastModifiedDateTime: requireString(raw.lastModifiedDateTime, "lastModifiedDateTime"),
  };
}

function mapShipmentLine(raw: BCSalesShipmentLineRaw): BCShipmentLine {
  return {
    sequence: requireNumber(raw.sequence, "sequence"),
    lineType: decodeShipmentLineType(raw.lineType),
    itemNumber: nullableString(raw.lineObjectNumber),
    description: nullableString(raw.description),
    description2: nullableString(raw.description2),
    unitOfMeasureCode: nullableString(raw.unitOfMeasureCode),
    quantity: requireNumber(raw.quantity, "quantity"),
    shipmentDate: nullableDate(raw.shipmentDate),
  };
}

export function mapShipment(raw: BCSalesShipmentRaw): BCShipment {
  return {
    ...mapShipmentHeader(raw),
    shipmentMethodCode: nullableString(raw.shipmentMethodCode),
    yourReference: nullableString(raw.customerPurchaseOrderReference),
    sellTo: {
      customerNumber: nullableString(raw.customerNumber),
      name: nullableString(raw.customerName),
      addressLine1: nullableString(raw.sellToAddressLine1),
      addressLine2: nullableString(raw.sellToAddressLine2),
      city: nullableString(raw.sellToCity),
      state: nullableString(raw.sellToState),
      postCode: nullableString(raw.sellToPostCode),
      country: nullableString(raw.sellToCountry),
    },
    billTo: {
      customerNumber: nullableString(raw.billToCustomerNumber),
      name: nullableString(raw.billToName),
      addressLine1: nullableString(raw.billToAddressLine1),
      addressLine2: nullableString(raw.billToAddressLine2),
      city: nullableString(raw.billToCity),
      state: nullableString(raw.billToState),
      postCode: nullableString(raw.billToPostCode),
      country: nullableString(raw.billToCountry),
    },
    shipTo: {
      name: nullableString(raw.shipToName),
      contact: nullableString(raw.shipToContact),
      addressLine1: nullableString(raw.shipToAddressLine1),
      addressLine2: nullableString(raw.shipToAddressLine2),
      city: nullableString(raw.shipToCity),
      state: nullableString(raw.shipToState),
      postCode: nullableString(raw.shipToPostCode),
      country: nullableString(raw.shipToCountry),
    },
    lines: (raw.salesShipmentLines ?? []).map(mapShipmentLine),
  };
}
