import {
  decideShipmentNotice,
  type ShipmentNoticeDecision,
  type ShipmentNoticeDecisionInput,
} from "../utils/decide-shipment-notice";
import type { BCShipment, BCShipmentLine } from "../../../modules/business-central/types";
import { ShipmentNoticePayloadSchema } from "../../../modules/order-ingestion/shipment-notice-contract";

function line(
  sequence: number,
  itemNumber: string | null,
  quantity: number,
  overrides: Partial<BCShipmentLine> = {}
): BCShipmentLine {
  return {
    sequence,
    lineType: "item",
    itemNumber,
    description: `Item ${itemNumber}`,
    description2: null,
    unitOfMeasureCode: "PCS",
    quantity,
    shipmentDate: "2026-10-21",
    ...overrides,
  };
}

function shipment(lines: BCShipmentLine[]): BCShipment {
  return {
    id: "bc-shp-1",
    number: "SS-1001",
    orderNumber: "SO-200",
    externalDocumentNumber: "METZ-77",
    customerNumber: "C-100",
    postingDate: "2026-10-21",
    lastModifiedDateTime: "2026-10-21T10:00:00Z",
    shipmentMethodCode: "GLS",
    yourReference: "PO-55",
    sellTo: {
      customerNumber: "C-100",
      name: "Metz A/S",
      addressLine1: "Vej 1",
      addressLine2: null,
      city: "Aarhus",
      state: null,
      postCode: "8000",
      country: "DK",
    },
    billTo: {
      customerNumber: "C-100",
      name: "Metz A/S",
      addressLine1: "Vej 1",
      addressLine2: null,
      city: "Aarhus",
      state: null,
      postCode: "8000",
      country: "DK",
    },
    shipTo: {
      name: "Shop 4",
      contact: "Receiving",
      addressLine1: "Gade 2",
      addressLine2: "Port 3",
      city: "Odense",
      state: null,
      postCode: "5000",
      country: "DK",
    },
    lines,
  };
}

const order: ShipmentNoticeDecisionInput["order"] = {
  order_id: "order_1",
  external_order_number: "METZ-77",
  bc_order_number: "SO-200",
  posting_date: "2026-10-21",
  bc_lines: [
    { line_number: 1, ean_no: "5701234000011", bc_sequence: 10000 },
    { line_number: 2, ean_no: "5701234000028", bc_sequence: 20000 },
    { line_number: 3, ean_no: null, bc_sequence: 30000 },
    { line_number: 4, ean_no: "5701234000042", bc_sequence: null },
  ],
};

function decide(
  lines: BCShipmentLine[],
  latest: ShipmentNoticeDecisionInput["latest"] = null,
  orderOverride: Partial<ShipmentNoticeDecisionInput["order"]> = {}
): ShipmentNoticeDecision {
  return decideShipmentNotice({
    shipment: shipment(lines),
    order: { ...order, ...orderOverride },
    latest,
  });
}

function recorded(decision: ShipmentNoticeDecision) {
  if (decision.kind !== "record") {
    throw new Error(`expected a record decision, got ${decision.kind}`);
  }
  return decision;
}

function quantities(decision: ShipmentNoticeDecision): Record<number, number> {
  return Object.fromEntries(
    recorded(decision).payload.lines.map((l) => [l.bc_line_number, l.quantity])
  );
}

function latestOf(decision: ShipmentNoticeDecision, revision = 1) {
  const record = recorded(decision);
  return {
    revision,
    content_hash: record.content_hash,
    listed_bc_line_numbers: record.payload.lines.map((l) => l.bc_line_number),
  };
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) {
    return [items];
  }
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [
      item,
      ...rest,
    ])
  );
}

describe("decideShipmentNotice: netting", () => {
  it.each([
    ["5000", 15000],
    ["2500", 12500],
  ])("nets a correction at offset %s with the nearest preceding positive line", (_, at) => {
    const decision = decide([line(10000, "A", 5), line(at, "A", -5), line(20000, "B", 2)]);
    expect(quantities(decision)).toEqual({ 20000: 2 });
  });

  it("nets a correction at offset 10000 after the last line", () => {
    const decision = decide([line(10000, "A", 5), line(20000, "B", 2), line(30000, "B", -2)]);
    expect(quantities(decision)).toEqual({ 10000: 5 });
  });

  it("nets each line of the same item separately", () => {
    const decision = decide([
      line(10000, "A", 2),
      line(20000, "A", 3),
      line(25000, "A", -3),
      line(30000, "A", 1),
    ]);
    expect(quantities(decision)).toEqual({ 10000: 2, 30000: 1 });
  });

  it("nets two corrections of consecutive lines against their own lines", () => {
    const decision = decide([
      line(10000, "A", 2),
      line(15000, "A", -2),
      line(20000, "A", 3),
      line(25000, "A", -3),
      line(30000, "B", 1),
    ]);
    expect(quantities(decision)).toEqual({ 30000: 1 });
  });

  it.each([
    ["item", line(25000, "B", -3)],
    ["unit", line(25000, "A", -3, { unitOfMeasureCode: "BOX" })],
    ["quantity", line(25000, "A", -2)],
  ])("gives unpairable when the nearest preceding line's %s differs", (_, correction) => {
    const decision = decide([line(10000, "A", 2), line(20000, "A", 3), correction]);
    expect(decision).toEqual({ kind: "unpairable", sequence: 25000 });
  });

  it("gives unpairable for a correction with no preceding positive line", () => {
    expect(decide([line(5000, "A", -2), line(10000, "A", 2)])).toEqual({
      kind: "unpairable",
      sequence: 5000,
    });
  });
});

describe("decideShipmentNotice: order independence", () => {
  const lines = [
    line(10000, "A", 2),
    line(20000, "A", 3),
    line(25000, "A", -3),
    line(30000, "B", 1),
    line(40000, null, 0, { lineType: "comment" }),
  ];

  it("gives the same result and hash for every permutation of the lines", () => {
    const expected = decide(lines);
    for (const permuted of permutations(lines)) {
      expect(decide(permuted)).toEqual(expected);
    }
  });

  it("gives the same 'nothing' for every permutation once a revision holds that content", () => {
    const latest = latestOf(decide(lines));
    for (const permuted of permutations(lines)) {
      expect(decide(permuted, latest)).toEqual({ kind: "nothing" });
    }
  });
});

describe("decideShipmentNotice: outcome", () => {
  it("records revision 1 as shipped, listing only lines with net quantity > 0", () => {
    const decision = recorded(
      decide([line(10000, "A", 2), line(20000, "B", 0), line(30000, "C", 1)])
    );
    expect(decision.status).toBe("shipped");
    expect(decision.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(quantities(decision)).toEqual({ 10000: 2, 30000: 1 });
  });

  it("records nothing when every line nets to zero before any revision", () => {
    expect(decide([line(10000, "A", 2), line(15000, "A", -2), line(20000, "B", 0)])).toEqual({
      kind: "nothing",
    });
  });

  it("records nothing when the content equals the latest revision", () => {
    const lines = [line(10000, "A", 2), line(30000, "C", 1)];
    expect(decide(lines, latestOf(decide(lines)))).toEqual({ kind: "nothing" });
  });

  it("records a revision listing every previously listed line, 0 where undone", () => {
    const latest = latestOf(decide([line(10000, "A", 2), line(30000, "C", 1)]));
    const decision = recorded(
      decide([line(10000, "A", 2), line(30000, "C", 1), line(35000, "C", -1)], latest)
    );
    expect(decision.status).toBe("revised");
    expect(decision.content_hash).not.toBe(latest.content_hash);
    expect(quantities(decision)).toEqual({ 10000: 2, 30000: 0 });
  });

  it("records cancelled when every listed line is undone", () => {
    const latest = latestOf(decide([line(10000, "A", 2), line(30000, "C", 1)]));
    const decision = recorded(
      decide(
        [line(10000, "A", 2), line(15000, "A", -2), line(30000, "C", 1), line(35000, "C", -1)],
        latest
      )
    );
    expect(decision.status).toBe("cancelled");
    expect(quantities(decision)).toEqual({ 10000: 0, 30000: 0 });
  });

  it("records nothing on the re-check after a revision with the same content", () => {
    const first = latestOf(decide([line(10000, "A", 2), line(30000, "C", 1)]));
    const undone = [line(10000, "A", 2), line(30000, "C", 1), line(35000, "C", -1)];
    const second = latestOf(decide(undone, first), 2);
    expect(second.listed_bc_line_numbers).toEqual([10000, 30000]);
    expect(decide(undone, second)).toEqual({ kind: "nothing" });
  });

  it("gives unpairable for a shipped item line BC sends without an item number", () => {
    expect(decide([line(10000, "A", 2), line(20000, null, 1)])).toEqual({
      kind: "unpairable",
      sequence: 20000,
    });
  });

  it("gives unpairable when a previously listed line is no longer on the shipment", () => {
    const latest = latestOf(decide([line(10000, "A", 2), line(30000, "C", 1)]));
    expect(decide([line(10000, "A", 1)], latest)).toEqual({
      kind: "unpairable",
      sequence: 30000,
    });
  });

  it("lists only item lines", () => {
    const decision = decide([
      line(10000, "A", 2),
      line(20000, null, 0, { lineType: "comment", description: "Note" }),
      line(30000, "FREIGHT-GL", 1, { lineType: "other" }),
      line(35000, "FREIGHT-GL", -1, { lineType: "other" }),
    ]);
    expect(quantities(decision)).toEqual({ 10000: 2 });
  });
});

describe("decideShipmentNotice: line match", () => {
  it("fills the customer's line number and EAN from the BC line map", () => {
    const lines = recorded(
      decide([
        line(10000, "A", 2),
        line(20000, "B", 1),
        line(30000, "C", 1),
        line(40000, "FREIGHT", 1),
      ])
    ).payload.lines;
    expect(lines.map((l) => [l.bc_line_number, l.line_number, l.ean_no])).toEqual([
      [10000, 1, "5701234000011"],
      [20000, 2, "5701234000028"],
      [30000, 3, null],
      // Freight or a BC-added line: not in the map (a map entry with a null bc_sequence never matches).
      [40000, null, null],
    ]);
  });

  it("gives nulls for every line of an older order without a map", () => {
    const lines = recorded(decide([line(10000, "A", 2)], null, { bc_lines: null })).payload.lines;
    expect(lines[0]).toMatchObject({ line_number: null, ean_no: null });
  });
});

describe("decideShipmentNotice: payload", () => {
  it("builds a contract payload with no price, salesperson, phone or email field", () => {
    const fromBc = {
      ...shipment([
        {
          ...line(10000, "A", 2),
          ...{ unitPrice: 99, discountPercent: 5 },
        },
      ]),
      salesperson: "JD",
      phoneNumber: "+45 1234",
      email: "buyer@example.com",
      currencyCode: "DKK",
    };
    const decision = recorded(decideShipmentNotice({ shipment: fromBc, order, latest: null }));

    expect(ShipmentNoticePayloadSchema.parse(decision.payload)).toEqual(decision.payload);
    const serialized = JSON.stringify(decision.payload);
    for (const forbidden of [
      "unitPrice",
      "discountPercent",
      "price",
      "salesperson",
      "phone",
      "email",
      "currency",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(decision.payload).toMatchObject({
      order_id: "order_1",
      external_order_number: "METZ-77",
      bc_order_number: "SO-200",
      shipment_number: "SS-1001",
      shipment_date: "2026-10-21",
      shipment_method_code: "GLS",
      your_reference: "PO-55",
      sell_to: { customer_number: "C-100", name: "Metz A/S", post_code: "8000" },
      ship_to: { name: "Shop 4", contact: "Receiving", address_line_2: "Port 3" },
    });
    expect(decision.payload.lines[0]).toEqual({
      line_number: 1,
      ean_no: "5701234000011",
      bc_line_number: 10000,
      item_number: "A",
      description: "Item A",
      description_2: null,
      unit_of_measure_code: "PCS",
      quantity: 2,
      shipment_date: "2026-10-21",
    });
  });

  it("uses the posting date for a line BC sends without a shipment date", () => {
    const lines = recorded(decide([line(10000, "A", 2, { shipmentDate: null })])).payload.lines;
    expect(lines[0].shipment_date).toBe("2026-10-21");
  });
});
