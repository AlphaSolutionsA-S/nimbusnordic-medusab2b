import {
  buildPostedReturnReceipts,
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

function mixedRows(): BCReturnListItem[] {
  return buildReturnListRows(
    [openReturn()],
    [
      receipt("30700005", "31400001", "2026-08-10"),
      receipt("30700007", "31400001", "2026-08-15"),
      receipt("30700003", "", "2026-09-28", "AX 209475"),
      receipt("30700001", "", ""),
    ]
  );
}

describe("buildReturnListRows", () => {
  // TC-1
  it("groups receipts under their open return order without adding a duplicate row", () => {
    const rows = buildReturnListRows(
      [openReturn()],
      [
        receipt("30700010", "31500002", "2026-09-25"),
        receipt("30700011", "31500002", "2026-09-22"),
      ]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      state: "open",
      source: "return_order",
      status: "Released",
      documentDate: "2026-09-20",
    });
    expect(rows[0].receipts.map((r) => r.number)).toEqual(["30700011", "30700010"]);
  });

  // TC-2
  it("turns the receipts of a return order that is no longer open into one processed row", () => {
    const rows = buildReturnListRows(
      [],
      [
        receipt("30700007", "31400001", "2026-08-15"),
        receipt("30700005", "31400001", "2026-08-10"),
      ]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "return-order:31400001",
      number: "31400001",
      state: "processed",
      source: "return_order",
      status: "",
      itemCount: 0,
      documentDate: "2026-08-15",
    });
    expect(rows[0].receipts.map((r) => r.number)).toEqual(["30700005", "30700007"]);
  });

  // TC-3
  it("turns a receipt without a return order into its own processed row", () => {
    const rows = buildReturnListRows([], [receipt("30700003", "", "2026-09-28", "AX 209475")]);

    expect(rows).toEqual([
      {
        id: "posted-receipt:30700003",
        number: "30700003",
        documentDate: "2026-09-28",
        status: "",
        state: "processed",
        source: "posted_receipt",
        itemCount: 0,
        receipts: [
          { number: "30700003", receivedDate: "2026-09-28", externalDocumentNumber: "AX 209475" },
        ],
      },
    ]);
  });

  // TC-4
  it("sorts rows by latest activity, newest first, with undated rows last", () => {
    expect(mixedRows().map((row) => row.number)).toEqual([
      "30700003",
      "31500002",
      "31400001",
      "30700001",
    ]);
  });

  // TC-5
  it("breaks date ties by number, descending", () => {
    const rows = buildReturnListRows(
      [],
      [receipt("30700001", "", "2026-09-01"), receipt("30700002", "", "2026-09-01")]
    );

    expect(rows.map((row) => row.number)).toEqual(["30700002", "30700001"]);
  });
});

describe("filterReturnListRows", () => {
  // TC-6
  it("filters by state", () => {
    const rows = mixedRows();

    const processed = filterReturnListRows(rows, { state: "processed" });
    const open = filterReturnListRows(rows, { state: "open" });

    expect(processed.map((row) => row.number)).toEqual(["30700003", "31400001", "30700001"]);
    expect(open.map((row) => row.number)).toEqual(["31500002"]);
  });

  // TC-7
  it("applies an inclusive date range and excludes undated rows", () => {
    const rows = filterReturnListRows(mixedRows(), {
      date_from: "2026-09-20",
      date_to: "2026-09-28",
    });

    expect(rows.map((row) => row.number)).toEqual(["30700003", "31500002"]);
  });

  // TC-8
  it("matches the row number or a receipt number, case-insensitively", () => {
    const rows = buildReturnListRows(
      [],
      [
        receipt("30700005", "31400001", "2026-08-10"),
        receipt("30700007", "31400001", "2026-08-15"),
        receipt("R-ABC", "", "2026-09-01"),
      ]
    );

    expect(filterReturnListRows(rows, { search: "30700007" }).map((row) => row.number)).toEqual([
      "31400001",
    ]);
    expect(filterReturnListRows(rows, { search: "r-abc" }).map((row) => row.number)).toEqual([
      "R-ABC",
    ]);
  });
});

describe("countReceiptItems", () => {
  // TC-9
  it("counts distinct received item + variant on Item lines of the given receipts only", () => {
    const lines = [
      line({ documentNumber: "30700005" }),
      line({ documentNumber: "30700007" }),
      line({ documentNumber: "30700007", itemNumber: "F2", variantCode: "", quantity: 0 }),
      line({ documentNumber: "30700007", lineType: " ", itemNumber: "" }),
      line({ documentNumber: "30700007", variantCode: "L" }),
      line({ documentNumber: "30799999", itemNumber: "OTHER" }),
    ];

    expect(countReceiptItems(["30700005", "30700007"], lines)).toBe(2);
  });
});

describe("latestReceivedDate", () => {
  // TC-10
  it("returns the latest received date, or an empty string", () => {
    expect(
      latestReceivedDate([
        { number: "1", receivedDate: "2026-08-10", externalDocumentNumber: "" },
        { number: "2", receivedDate: "", externalDocumentNumber: "" },
        { number: "3", receivedDate: "2026-08-15", externalDocumentNumber: "" },
      ])
    ).toBe("2026-08-15");
    expect(latestReceivedDate([])).toBe("");
  });
});

describe("buildPostedReturnReceipts", () => {
  // TC-15
  it("sorts receipts oldest first, drops text and zero-quantity lines and maps display fields", () => {
    const headers = [
      receipt("30700012", "31502910", "2026-09-29"),
      receipt("30700011", "31502910", "2026-09-28"),
    ];
    const lines = [
      line({ documentNumber: "30700011", lineNumber: 30000 }),
      line({ documentNumber: "30700011", lineNumber: 20000 }),
      line({ documentNumber: "30700011", lineNumber: 10000, lineType: " ", itemNumber: "" }),
      line({ documentNumber: "30700012", lineNumber: 40000, quantity: 0 }),
      line({ documentNumber: "30799999", lineNumber: 10000 }),
    ];

    const receipts = buildPostedReturnReceipts(headers, lines);

    expect(receipts.map((r) => r.number)).toEqual(["30700011", "30700012"]);
    expect(receipts[0].lines.map((l) => l.lineNumber)).toEqual([20000, 30000]);
    expect(receipts[1].lines).toEqual([]);
    for (const receiptLine of receipts.flatMap((r) => r.lines)) {
      expect(receiptLine).not.toHaveProperty("documentNumber");
      expect(receiptLine).not.toHaveProperty("lineType");
    }
  });
});
