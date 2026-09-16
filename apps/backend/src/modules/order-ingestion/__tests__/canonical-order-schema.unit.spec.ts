import { CanonicalOrderSchema } from "../canonical-order-schema";
import {
  singleLineCanonicalOrder,
  multiLineCanonicalOrder,
} from "../__fixtures__/canonical-order-fixtures";

describe("CanonicalOrderSchema", () => {
  it("TC-1: accepts a valid single-line order derived from a real EDI sample (happy path)", () => {
    const result = CanonicalOrderSchema.safeParse(singleLineCanonicalOrder);
    expect(result.success).toBe(true);
  });

  it("TC-2: accepts a valid multi-line order with an optional shipTo address", () => {
    const result = CanonicalOrderSchema.safeParse(multiLineCanonicalOrder);
    expect(result.success).toBe(true);
  });

  it("TC-3: rejects a payload missing externalOrderNumber (edge case: required header field)", () => {
    const { externalOrderNumber, ...withoutExternalOrderNumber } =
      singleLineCanonicalOrder;
    const result = CanonicalOrderSchema.safeParse(withoutExternalOrderNumber);
    expect(result.success).toBe(false);
  });

  it('TC-4: rejects a payload with an empty lines array (NIMBUS-147 "at least one order line" rule)', () => {
    const result = CanonicalOrderSchema.safeParse({
      ...singleLineCanonicalOrder,
      lines: [],
    });
    expect(result.success).toBe(false);
  });

  it("TC-5: accepts a payload that omits billTo and shipTo entirely (both optional per NIMBUS-147)", () => {
    const result = CanonicalOrderSchema.safeParse(singleLineCanonicalOrder);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.billTo).toBeUndefined();
      expect(result.data.shipTo).toBeUndefined();
    }
  });

  it("TC-6: accepts a line carrying only what the submitter owns — what item, how many; itemNumber, description and unitPrice are all optional", () => {
    const result = CanonicalOrderSchema.safeParse({
      ...singleLineCanonicalOrder,
      lines: [
        {
          lineNumber: 1,
          eanNo: "5712094145752",
          quantity: 1,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("TC-6b: still accepts a submitted unitPrice, retained as a stated expectation for discrepancy checking", () => {
    const result = CanonicalOrderSchema.safeParse({
      ...singleLineCanonicalOrder,
      lines: [
        {
          lineNumber: 1,
          eanNo: "5712094145752",
          quantity: 1,
          unitPrice: 134.75,
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lines[0].unitPrice).toEqual(134.75);
    }
  });

  it("TC-7: still rejects a line with no eanNo (the item identifier stays required)", () => {
    const { eanNo, ...lineWithoutEan } = singleLineCanonicalOrder.lines[0];
    const result = CanonicalOrderSchema.safeParse({
      ...singleLineCanonicalOrder,
      lines: [lineWithoutEan],
    });
    expect(result.success).toBe(false);
  });

  it("TC-9: rejects an eanNo that is not a 13-digit GTIN", () => {
    for (const eanNo of ["x", "571209414575", "57120941457521", "571209414575a"]) {
      const result = CanonicalOrderSchema.safeParse({
        ...singleLineCanonicalOrder,
        lines: [{ ...singleLineCanonicalOrder.lines[0], eanNo }],
      });
      expect(result.success).toBe(false);
    }
  });

  it("TC-10: rejects duplicate lineNumbers within one order, but allows a repeated eanNo (same item, different lines)", () => {
    const line = singleLineCanonicalOrder.lines[0];

    const duplicateLineNumbers = CanonicalOrderSchema.safeParse({
      ...singleLineCanonicalOrder,
      lines: [line, { ...line, lineNumber: 1 }],
    });
    expect(duplicateLineNumbers.success).toBe(false);

    const repeatedEan = CanonicalOrderSchema.safeParse({
      ...singleLineCanonicalOrder,
      lines: [line, { ...line, lineNumber: 2 }],
    });
    expect(repeatedEan.success).toBe(true);
  });

  it("TC-11: rejects a currencyCode that is not a 3-letter ISO code", () => {
    for (const currencyCode of ["Danish Kroner", "DK", "DKKK", "DK1"]) {
      const result = CanonicalOrderSchema.safeParse({
        ...singleLineCanonicalOrder,
        currencyCode,
      });
      expect(result.success).toBe(false);
    }
  });

  it("TC-12: requires DD-MM-YYYY dates and rejects impossible calendar dates", () => {
    for (const orderDate of [
      "sometime next week",
      "2026-08-27",
      "27/08/2026",
      "31-02-2026",
      "32-01-2026",
      "27-13-2026",
    ]) {
      const result = CanonicalOrderSchema.safeParse({
        ...singleLineCanonicalOrder,
        orderDate,
      });
      expect(result.success).toBe(false);
    }

    expect(
      CanonicalOrderSchema.safeParse({
        ...singleLineCanonicalOrder,
        orderDate: "29-02-2028",
      }).success
    ).toBe(true);
  });

  it("TC-13: applies the same date rule to the optional date fields", () => {
    expect(
      CanonicalOrderSchema.safeParse({
        ...singleLineCanonicalOrder,
        requestedDeliveryDate: "2026-09-03",
      }).success
    ).toBe(false);

    expect(
      CanonicalOrderSchema.safeParse({
        ...singleLineCanonicalOrder,
        lines: [
          {
            ...singleLineCanonicalOrder.lines[0],
            requestedShipmentDate: "2026-09-03",
          },
        ],
      }).success
    ).toBe(false);

    expect(
      CanonicalOrderSchema.safeParse({
        ...singleLineCanonicalOrder,
        requestedDeliveryDate: "03-09-2026",
      }).success
    ).toBe(true);
  });

  it('TC-14: rejects an unknown top-level field (schema is .strict() — there is no looser "envelope" tier anymore)', () => {
    const result = CanonicalOrderSchema.safeParse({
      ...singleLineCanonicalOrder,
      unexpectedField: "should not be accepted",
    });
    expect(result.success).toBe(false);
  });
});
