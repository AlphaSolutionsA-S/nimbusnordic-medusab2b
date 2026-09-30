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

  describe("address country (NIMBUS-171)", () => {
    const address = {
      name: "JK Tryk",
      addressLine1: "Industrikrogen 11B",
      city: "Rønnede",
      postCode: "4683",
      country: "DK",
    };

    it("TC-15: accepts ISO codes in any case with surrounding whitespace on billTo and shipTo, and outputs the trimmed upper-case code", () => {
      const cases: ReadonlyArray<readonly [string, string]> = [
        ["DK", "DK"],
        ["dk", "DK"],
        [" SE ", "SE"],
        ["\tno\n", "NO"],
        ["Gb", "GB"],
      ];

      for (const [sent, expected] of cases) {
        const result = CanonicalOrderSchema.safeParse({
          ...singleLineCanonicalOrder,
          billTo: { ...address, country: sent },
          shipTo: { ...address, country: sent },
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.billTo?.country).toEqual(expected);
          expect(result.data.shipTo?.country).toEqual(expected);
        }
      }
    });

    it("TC-16: rejects a shipTo.country that is not an officially assigned ISO code, naming the field path and the value sent", () => {
      for (const country of ["DNK", "Denmark", "XX", "", "   ", "XK", "UK", "EU", "ß", "ıt"]) {
        const result = CanonicalOrderSchema.safeParse({
          ...singleLineCanonicalOrder,
          shipTo: { ...address, country },
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues).toHaveLength(1);
          expect(result.error.issues[0].path).toEqual(["shipTo", "country"]);
          expect(result.error.issues[0].message).toEqual(
            `Field 'shipTo.country' must be an ISO 3166-1 alpha-2 country code, but got: '${country}'`
          );
        }
      }
    });

    it("TC-16b: echoes at most 20 characters of a long rejected country value", () => {
      const result = CanonicalOrderSchema.safeParse({
        ...singleLineCanonicalOrder,
        shipTo: { ...address, country: "Kingdom of Denmark and more" },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toEqual(
          "Field 'shipTo.country' must be an ISO 3166-1 alpha-2 country code, but got: 'Kingdom of Denmark a...'"
        );
      }
    });

    it("TC-17: applies the same rule to billTo.country (every address in the order)", () => {
      const result = CanonicalOrderSchema.safeParse({
        ...singleLineCanonicalOrder,
        billTo: { ...address, country: "Denmark" },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(["billTo", "country"]);
        expect(result.error.issues[0].message).toContain("'Denmark'");
      }
    });

    it("TC-18: reports both addresses when both countries are invalid", () => {
      const result = CanonicalOrderSchema.safeParse({
        ...singleLineCanonicalOrder,
        billTo: { ...address, country: "DNK" },
        shipTo: { ...address, country: "Sweden" },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((issue) => issue.path)).toEqual(
          expect.arrayContaining([
            ["billTo", "country"],
            ["shipTo", "country"],
          ])
        );
      }
    });

    it("TC-19: still rejects a non-string country with a type error", () => {
      const result = CanonicalOrderSchema.safeParse({
        ...singleLineCanonicalOrder,
        shipTo: { ...address, country: 45 },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(["shipTo", "country"]);
        expect(result.error.issues[0].code).toEqual("invalid_type");
      }
    });
  });
});
