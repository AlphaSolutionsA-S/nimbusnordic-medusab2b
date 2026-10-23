import type {
  BCItem,
  BCItemBarcodeReference,
  BCItemLookupEvidence,
} from "../../../modules/business-central/types";
import { resolveOrderLineItem } from "../utils/resolve-order-line-item";

// Fixture shapes follow the TestDK rows in issues/NIMBUS-180/samples/.
const HEND_SIZES = [
  { id: "a419dfc8-ab92-ee11-8178-0022489b54b1", code: "XS" },
  { id: "a219dfc8-ab92-ee11-8178-0022489b54b1", code: "S" },
  { id: "a119dfc8-ab92-ee11-8178-0022489b54b1", code: "M" },
  { id: "a019dfc8-ab92-ee11-8178-0022489b54b1", code: "L" },
  { id: "a319dfc8-ab92-ee11-8178-0022489b54b1", code: "XL" },
  { id: "9e19dfc8-ab92-ee11-8178-0022489b54b1", code: "2XL" },
  { id: "9f19dfc8-ab92-ee11-8178-0022489b54b1", code: "3XL" },
];
const HEND: BCItem = {
  id: "d22247f7-005e-ee11-8def-0022489bc7be",
  number: "HEND-L-MIDNBLUE",
  displayName: "Henderson Women - Midnight Blue",
  gtin: "",
  baseUnitOfMeasureCode: "PCS",
  variants: HEND_SIZES,
};
const HEND_L_BARCODE = "5712094132141";
const HEND_L_ID = "a019dfc8-ab92-ee11-8178-0022489b54b1";

// An item without sizes, reachable by its item-card barcode (scope F3, Metz case).
const METZ_PLAIN: BCItem = {
  id: "item-plain",
  number: "POS LOGO SIGN-BLACK",
  displayName: "POS logo sign",
  gtin: "5712094100003",
  baseUnitOfMeasureCode: "PCS",
  variants: [],
};
const OTHER_PLAIN: BCItem = {
  id: "item-other",
  number: "LONG-U-GREYMEL",
  displayName: "Longsleeve",
  gtin: "",
  baseUnitOfMeasureCode: "PCS",
  variants: [],
};

function ref(patch: Partial<BCItemBarcodeReference> = {}): BCItemBarcodeReference {
  return {
    barcode: HEND_L_BARCODE,
    itemNumber: "HEND-L-MIDNBLUE",
    variantCode: "L",
    unitOfMeasureCode: "",
    referenceType: "bar_code",
    ...patch,
  };
}

// The three rows TestDK holds for each HEND-L-MIDNBLUE size barcode.
const HEND_L_ROWS = [
  ref(),
  ref({ unitOfMeasureCode: "PCS" }),
  ref({ unitOfMeasureCode: "PCS", referenceType: "other" }),
];

function evidence(patch: Partial<BCItemLookupEvidence> = {}): BCItemLookupEvidence {
  return { itemsByBarcode: [], barcodeReferences: [], itemsByNumber: [], ...patch };
}

describe("resolveOrderLineItem", () => {
  describe("size barcodes (Item Reference rows)", () => {
    it("resolves the TestDK L barcode with its three rows to the item and the L size", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE },
          evidence({ barcodeReferences: HEND_L_ROWS, itemsByNumber: [HEND] })
        )
      ).toEqual({
        resolved: true,
        itemId: HEND.id,
        itemVariantId: HEND_L_ID,
        matchedBy: "itemReference",
      });
    });

    it("treats a row of another reference type alone as no reference", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE },
          evidence({
            barcodeReferences: [ref({ unitOfMeasureCode: "PCS", referenceType: "other" })],
            itemsByNumber: [HEND],
          })
        )
      ).toEqual({ resolved: false, reason: "not_found" });
    });

    it("row 5: resolves the size when the item card agrees on the item", () => {
      const hendWithGtin = { ...HEND, gtin: HEND_L_BARCODE };
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE },
          evidence({
            itemsByBarcode: [hendWithGtin],
            barcodeReferences: [ref()],
            itemsByNumber: [hendWithGtin],
          })
        )
      ).toEqual({
        resolved: true,
        itemId: HEND.id,
        itemVariantId: HEND_L_ID,
        matchedBy: "itemReference",
      });
    });

    it("compares size codes case-insensitively", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE },
          evidence({ barcodeReferences: [ref({ variantCode: "l" })], itemsByNumber: [HEND] })
        )
      ).toMatchObject({ resolved: true, itemVariantId: HEND_L_ID });
    });

    it("row 6: refuses a size the item does not list", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE },
          evidence({ barcodeReferences: [ref({ variantCode: "4XL" })], itemsByNumber: [HEND] })
        )
      ).toEqual({ resolved: false, reason: "size_unresolved" });
    });

    it("row 6: refuses a size on an item without sizes", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE },
          evidence({
            barcodeReferences: [ref({ itemNumber: OTHER_PLAIN.number, variantCode: "L" })],
            itemsByNumber: [OTHER_PLAIN],
          })
        )
      ).toEqual({ resolved: false, reason: "size_unresolved" });
    });

    it("row 7: resolves a row with no size on an item without sizes, with no size", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE },
          evidence({
            barcodeReferences: [ref({ itemNumber: OTHER_PLAIN.number, variantCode: "" })],
            itemsByNumber: [OTHER_PLAIN],
          })
        )
      ).toEqual({
        resolved: true,
        itemId: OTHER_PLAIN.id,
        itemVariantId: null,
        matchedBy: "itemReference",
      });
    });

    it("row 8: refuses a row with no size on an item with sizes", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE },
          evidence({ barcodeReferences: [ref({ variantCode: "" })], itemsByNumber: [HEND] })
        )
      ).toEqual({ resolved: false, reason: "size_unresolved" });
    });

    it("row 9: refuses a row whose item the number read did not return", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE, itemNumber: OTHER_PLAIN.number },
          evidence({ barcodeReferences: [ref()], itemsByNumber: [OTHER_PLAIN] })
        )
      ).toEqual({ resolved: false, reason: "not_found" });
    });
  });

  describe("unit of measure", () => {
    it("counts an empty-unit row for any line unit", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE, unitOfMeasureCode: "CTN" },
          evidence({ barcodeReferences: [ref()], itemsByNumber: [HEND] })
        )
      ).toMatchObject({ resolved: true, itemVariantId: HEND_L_ID });
    });

    it("counts a PCS row for the line unit pcs", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE, unitOfMeasureCode: "pcs" },
          evidence({
            barcodeReferences: [ref({ unitOfMeasureCode: "PCS" })],
            itemsByNumber: [HEND],
          })
        )
      ).toMatchObject({ resolved: true, itemVariantId: HEND_L_ID });
    });

    it("counts a PCS row for a line with no unit when the item's base unit is PCS", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE },
          evidence({
            barcodeReferences: [ref({ unitOfMeasureCode: "PCS" })],
            itemsByNumber: [HEND],
          })
        )
      ).toMatchObject({ resolved: true, itemVariantId: HEND_L_ID });
    });

    it("row 2: refuses with unit_mismatch when only a CTN row exists, without fallback", () => {
      for (const unitOfMeasureCode of [undefined, "PCS"]) {
        expect(
          resolveOrderLineItem(
            { eanNo: HEND_L_BARCODE, itemNumber: OTHER_PLAIN.number, unitOfMeasureCode },
            evidence({
              barcodeReferences: [ref({ unitOfMeasureCode: "CTN" })],
              itemsByNumber: [HEND, OTHER_PLAIN],
            })
          )
        ).toEqual({ resolved: false, reason: "unit_mismatch" });
      }
    });

    it("ignores a row for another unit when a matching row exists", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE, unitOfMeasureCode: "PCS" },
          evidence({
            barcodeReferences: [
              ref({ unitOfMeasureCode: "CTN", variantCode: "XL" }),
              ref({ unitOfMeasureCode: "PCS" }),
            ],
            itemsByNumber: [HEND],
          })
        )
      ).toMatchObject({ resolved: true, itemVariantId: HEND_L_ID });
    });
  });

  describe("ambiguity", () => {
    it("row 3: refuses when the item card and a reference name different items", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE },
          evidence({
            itemsByBarcode: [{ ...OTHER_PLAIN, gtin: HEND_L_BARCODE }],
            barcodeReferences: [ref()],
            itemsByNumber: [HEND],
          })
        )
      ).toEqual({ resolved: false, reason: "ambiguous" });
    });

    it("row 3: refuses when two item cards carry the barcode", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: METZ_PLAIN.gtin },
          evidence({ itemsByBarcode: [METZ_PLAIN, { ...OTHER_PLAIN, gtin: METZ_PLAIN.gtin }] })
        )
      ).toEqual({ resolved: false, reason: "ambiguous" });
    });

    it("row 3: an ambiguous barcode does not fall back to an item number that would match", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE, itemNumber: OTHER_PLAIN.number },
          evidence({
            barcodeReferences: [ref(), ref({ itemNumber: OTHER_PLAIN.number, variantCode: "" })],
            itemsByNumber: [HEND, OTHER_PLAIN],
          })
        )
      ).toEqual({ resolved: false, reason: "ambiguous" });
    });

    it("row 4: refuses when the rows name more than one size, an empty code counting as one", () => {
      for (const otherCode of ["M", ""]) {
        expect(
          resolveOrderLineItem(
            { eanNo: HEND_L_BARCODE },
            evidence({
              barcodeReferences: [ref(), ref({ variantCode: otherCode })],
              itemsByNumber: [HEND],
            })
          )
        ).toEqual({ resolved: false, reason: "ambiguous" });
      }
    });
  });

  describe("item-card barcode", () => {
    it("row 7: resolves an item-card barcode on an item without sizes, with no size (Metz)", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: METZ_PLAIN.gtin },
          evidence({ itemsByBarcode: [METZ_PLAIN] })
        )
      ).toEqual({
        resolved: true,
        itemId: METZ_PLAIN.id,
        itemVariantId: null,
        matchedBy: "eanNo",
      });
    });

    it("row 8: refuses an item-card barcode on an item with sizes", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE },
          evidence({ itemsByBarcode: [{ ...HEND, gtin: HEND_L_BARCODE }] })
        )
      ).toEqual({ resolved: false, reason: "size_unresolved" });
    });

    it("never matches an item with a blank item-card barcode", () => {
      expect(
        resolveOrderLineItem({ eanNo: " " }, evidence({ itemsByBarcode: [OTHER_PLAIN] }))
      ).toEqual({ resolved: false, reason: "no_identifiers" });
    });
  });

  describe("item number fallback", () => {
    it("row 1: refuses as not_found when nothing matches and no number is usable", () => {
      expect(resolveOrderLineItem({ eanNo: HEND_L_BARCODE }, evidence())).toEqual({
        resolved: false,
        reason: "not_found",
      });
    });

    it("row 1: refuses as no_identifiers only when every identifier is blank", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: "", itemNumber: " ", custItemNo: "" },
          evidence({ itemsByNumber: [OTHER_PLAIN] })
        )
      ).toEqual({ resolved: false, reason: "no_identifiers" });
    });

    it("row 10: resolves by item number to an item without sizes", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE, itemNumber: ` ${OTHER_PLAIN.number} ` },
          evidence({ itemsByNumber: [OTHER_PLAIN] })
        )
      ).toEqual({
        resolved: true,
        itemId: OTHER_PLAIN.id,
        itemVariantId: null,
        matchedBy: "itemNumber",
      });
    });

    it("row 10: falls back to the customer item number when the item number finds nothing", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE, itemNumber: "NKT-NIM-TELLURIDENA-S", custItemNo: OTHER_PLAIN.number },
          evidence({ itemsByNumber: [OTHER_PLAIN] })
        )
      ).toEqual({
        resolved: true,
        itemId: OTHER_PLAIN.id,
        itemVariantId: null,
        matchedBy: "custItemNo",
      });
    });

    it("row 10: reports itemNumber when both numbers are the same", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE, itemNumber: OTHER_PLAIN.number, custItemNo: OTHER_PLAIN.number },
          evidence({ itemsByNumber: [OTHER_PLAIN] })
        )
      ).toMatchObject({ resolved: true, matchedBy: "itemNumber" });
    });

    it("row 11: refuses an item with sizes reached by item number", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE, itemNumber: HEND.number, custItemNo: OTHER_PLAIN.number },
          evidence({ itemsByNumber: [HEND, OTHER_PLAIN] })
        )
      ).toEqual({ resolved: false, reason: "size_unresolved" });
    });

    it("row 12: refuses as ambiguous when a number matches several items and none exactly one", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE, itemNumber: OTHER_PLAIN.number },
          evidence({ itemsByNumber: [OTHER_PLAIN, { ...OTHER_PLAIN, id: "item-other-2" }] })
        )
      ).toEqual({ resolved: false, reason: "ambiguous" });
    });

    it("row 12: a later number that matches exactly one item still resolves", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE, itemNumber: OTHER_PLAIN.number, custItemNo: METZ_PLAIN.number },
          evidence({
            itemsByNumber: [OTHER_PLAIN, { ...OTHER_PLAIN, id: "item-other-2" }, METZ_PLAIN],
          })
        )
      ).toMatchObject({ resolved: true, itemId: METZ_PLAIN.id, matchedBy: "custItemNo" });
    });

    it("counts the same item listed twice as one match", () => {
      expect(
        resolveOrderLineItem(
          { eanNo: HEND_L_BARCODE, itemNumber: OTHER_PLAIN.number },
          evidence({ itemsByNumber: [OTHER_PLAIN, OTHER_PLAIN] })
        )
      ).toMatchObject({ resolved: true, itemId: OTHER_PLAIN.id });
    });
  });
});
