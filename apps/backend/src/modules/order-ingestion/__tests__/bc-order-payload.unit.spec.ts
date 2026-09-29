import {
  canonicalDateToBcDate,
  parseBcOrderPayload,
  readCompanyIdFromMetadata,
} from "../bc-order-payload";
import { multiLineCanonicalOrder } from "../__fixtures__/canonical-order-fixtures";

describe("parseBcOrderPayload", () => {
  it("TC-6: reads the real-EDI-derived canonical order out of metadata", () => {
    const result = parseBcOrderPayload({ canonical_order: multiLineCanonicalOrder });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.externalOrderNumber).toEqual("NKT004061");
      expect(result.payload.orderDate).toEqual("26-08-2026");
      expect(result.payload.currencyCode).toEqual("DKK");
      expect(result.payload.lines).toHaveLength(2);
      expect(result.payload.lines[1].eanNo).toEqual("5712094143635");
      expect(result.payload.lines[1].itemNumber).toEqual("NKT-NIM-TELLURIDENA-M");
      expect(result.payload.lines[1].quantity).toEqual(10);
    }
  });

  it("TC-7: strips fields this story does not send instead of rejecting them", () => {
    const result = parseBcOrderPayload({
      canonical_order: {
        ...multiLineCanonicalOrder,
        pricesIncludeTax: false,
        lines: [
          {
            ...multiLineCanonicalOrder.lines[0],
            description2: "Embroidered",
            taxPercent: 25,
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.payload.lines[0])).not.toContain("unitPrice");
      expect(Object.keys(result.payload.lines[0])).not.toContain("description");
    }
  });

  it("TC-8: reports missing or unusable payloads as a failed result rather than throwing", () => {
    const results = [
      parseBcOrderPayload(null),
      parseBcOrderPayload({}),
      parseBcOrderPayload({
        canonical_order: { ...multiLineCanonicalOrder, lines: [] },
      }),
      parseBcOrderPayload({ canonical_order: "not-an-order" }),
      parseBcOrderPayload({
        canonical_order: { ...multiLineCanonicalOrder, orderDate: "2026-08-26" },
      }),
    ];

    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("readCompanyIdFromMetadata", () => {
  it("TC-9: only accepts a non-empty string company id", () => {
    expect(readCompanyIdFromMetadata({ company_id: "comp_01" })).toEqual("comp_01");
    expect(readCompanyIdFromMetadata({ company_id: "" })).toBeNull();
    expect(readCompanyIdFromMetadata({ company_id: 42 })).toBeNull();
    expect(readCompanyIdFromMetadata({})).toBeNull();
    expect(readCompanyIdFromMetadata(null)).toBeNull();
  });
});

describe("canonicalDateToBcDate", () => {
  it("TC-10: converts DD-MM-YYYY to YYYY-MM-DD", () => {
    expect(canonicalDateToBcDate("26-08-2026")).toEqual("2026-08-26");
    expect(canonicalDateToBcDate("29-02-2028")).toEqual("2028-02-29");
  });
});
