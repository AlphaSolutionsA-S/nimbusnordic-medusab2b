import type {
  BCItem,
  BCItemBarcodeReference,
  BCItemLookupEvidence,
  BCItemMatchSource,
} from "../../../modules/business-central/types";
import type { BcOrderLineFailureReason } from "../../../modules/order-ingestion/bc-integration-state";

export type OrderLineItemInput = {
  eanNo: string;
  itemNumber?: string;
  custItemNo?: string;
  unitOfMeasureCode?: string;
};

export type OrderLineItemResolution =
  | {
      resolved: true;
      itemId: string;
      itemVariantId: string | null;
      matchedBy: BCItemMatchSource;
    }
  | {
      resolved: false;
      reason: Exclude<BcOrderLineFailureReason, "rejected_by_bc">;
    };

type Refusal = Extract<OrderLineItemResolution, { resolved: false }>;

function refused(reason: Refusal["reason"]): Refusal {
  return { resolved: false, reason };
}

// BC stores codes (item numbers, sizes, units) upper-case; a customer may send them in any case.
function normalizeCode(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function findItemsByNumber(items: BCItem[], number: string): BCItem[] {
  const byId = new Map<string, BCItem>();

  for (const item of items) {
    if (normalizeCode(item.number) === number) {
      byId.set(item.id, item);
    }
  }

  return [...byId.values()];
}

// An item with sizes is never sent without its size; a size the item does not list is never sent.
function resolveSize(
  item: BCItem,
  sizeCode: string,
  matchedBy: BCItemMatchSource
): OrderLineItemResolution {
  if (!sizeCode) {
    return item.variants.length === 0
      ? { resolved: true, itemId: item.id, itemVariantId: null, matchedBy }
      : refused("size_unresolved");
  }

  const variant = item.variants.find(
    (candidate) => normalizeCode(candidate.code) === sizeCode
  );

  return variant
    ? { resolved: true, itemId: item.id, itemVariantId: variant.id, matchedBy }
    : refused("size_unresolved");
}

// A row counts when its unit is empty, equals the line's unit, or, for a line without a unit,
// equals the named item's base unit.
function rowUnitFits(
  row: BCItemBarcodeReference,
  lineUnit: string,
  evidence: BCItemLookupEvidence
): boolean {
  const rowUnit = normalizeCode(row.unitOfMeasureCode);

  if (!rowUnit) {
    return true;
  }

  if (lineUnit) {
    return rowUnit === lineUnit;
  }

  const [item] = findItemsByNumber(
    [...evidence.itemsByNumber, ...evidence.itemsByBarcode],
    normalizeCode(row.itemNumber)
  );

  // Without the named item its base unit is unknown; the row is kept so the line is refused as
  // not found rather than as a unit mismatch.
  return !item || normalizeCode(item.baseUnitOfMeasureCode) === rowUnit;
}

function resolveByBarcode(
  barcode: string,
  line: OrderLineItemInput,
  evidence: BCItemLookupEvidence
): OrderLineItemResolution | null {
  const cardItems = evidence.itemsByBarcode.filter(
    (item) => item.gtin.trim() === barcode
  );
  const rows = evidence.barcodeReferences.filter(
    (row) => row.referenceType === "bar_code" && row.barcode.trim() === barcode
  );

  if (cardItems.length === 0 && rows.length === 0) {
    return null;
  }

  const lineUnit = normalizeCode(line.unitOfMeasureCode);
  const usableRows = rows.filter((row) => rowUnitFits(row, lineUnit, evidence));

  if (cardItems.length === 0 && usableRows.length === 0) {
    return refused("unit_mismatch");
  }

  const itemNumbers = new Set([
    ...cardItems.map((item) => normalizeCode(item.number)),
    ...usableRows.map((row) => normalizeCode(row.itemNumber)),
  ]);
  const sizeCodes = new Set(usableRows.map((row) => normalizeCode(row.variantCode)));

  if (itemNumbers.size > 1 || sizeCodes.size > 1) {
    return refused("ambiguous");
  }

  const [itemNumber] = itemNumbers;
  const items = findItemsByNumber(
    [...cardItems, ...evidence.itemsByNumber],
    itemNumber
  );

  if (items.length !== 1) {
    return refused(items.length === 0 ? "not_found" : "ambiguous");
  }

  if (usableRows.length === 0) {
    return resolveSize(items[0], "", "eanNo");
  }

  const [sizeCode] = sizeCodes;

  return resolveSize(items[0], sizeCode, "itemReference");
}

function resolveByNumber(
  line: OrderLineItemInput,
  evidence: BCItemLookupEvidence,
  hasBarcode: boolean
): OrderLineItemResolution {
  const candidates: { source: BCItemMatchSource; number: string }[] = [];

  for (const [source, value] of [
    ["itemNumber", line.itemNumber],
    ["custItemNo", line.custItemNo],
  ] as const) {
    const number = normalizeCode(value);

    if (number && !candidates.some((candidate) => candidate.number === number)) {
      candidates.push({ source, number });
    }
  }

  if (candidates.length === 0) {
    return refused(hasBarcode ? "not_found" : "no_identifiers");
  }

  let sawAmbiguousMatch = false;

  for (const { source, number } of candidates) {
    const items = findItemsByNumber(evidence.itemsByNumber, number);

    if (items.length === 1) {
      return resolveSize(items[0], "", source);
    }

    sawAmbiguousMatch ||= items.length > 1;
  }

  return refused(sawAmbiguousMatch ? "ambiguous" : "not_found");
}

/**
 * Decides which BC item and size an order line names, from the evidence read for its order
 * (NIMBUS-180). Only "Bar Code" Item Reference rows whose unit fits the line count; a barcode that
 * matches anything decides the line, and the item-number fallback applies only when it matches
 * nothing. Values the adapter never requested (blank, over 20 characters) simply find no item.
 */
export function resolveOrderLineItem(
  line: OrderLineItemInput,
  evidence: BCItemLookupEvidence
): OrderLineItemResolution {
  const barcode = line.eanNo.trim();

  if (barcode) {
    const outcome = resolveByBarcode(barcode, line, evidence);

    if (outcome) {
      return outcome;
    }
  }

  return resolveByNumber(line, evidence, barcode.length > 0);
}
