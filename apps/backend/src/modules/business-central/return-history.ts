import type {
  BCListReturnsParams,
  BCPostedReturnReceipt,
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
