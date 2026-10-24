import { MedusaError } from "@medusajs/framework/utils";

import type { BCItem, BCItemBarcodeReference, BCItemLookupInput } from "./types";

// Keeps every `or` filter, and so the request URL, bounded.
const ITEM_LOOKUP_VALUES_PER_REQUEST = 20;
// BC's item No. field; a longer value in a filter makes BC reject the whole request with 400.
const BC_ITEM_NUMBER_MAX_LENGTH = 20;
const BC_BAR_CODE_REFERENCE_TYPE = "Bar Code";

export const ITEM_REFERENCE_ENTITY_SET = "ItemReferenceEntries";
export const ITEM_REFERENCE_FIELDS =
  "Item_No,Variant_Code,Unit_of_Measure,Reference_Type,Reference_No";
export const ITEM_LOOKUP_SELECT = "id,number,displayName,gtin,baseUnitOfMeasureCode";
export const ITEM_LOOKUP_EXPAND = "itemVariants($select=id,code)";

export type BCItemLookupItemRaw = {
  id?: unknown;
  number?: unknown;
  displayName?: unknown;
  gtin?: unknown;
  baseUnitOfMeasureCode?: unknown;
  itemVariants?: unknown;
};

export type BCItemReferenceRaw = {
  Item_No?: unknown;
  Variant_Code?: unknown;
  Unit_of_Measure?: unknown;
  Reference_Type?: unknown;
  Reference_No?: unknown;
};

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function uniqueNonBlank(values: readonly (string | undefined)[]): string[] {
  return [
    ...new Set(values.map((value) => (value ?? "").trim()).filter((value) => value !== "")),
  ];
}

export function chunkLookupValues(values: readonly string[]): string[][] {
  const chunks: string[][] = [];

  for (let index = 0; index < values.length; index += ITEM_LOOKUP_VALUES_PER_REQUEST) {
    chunks.push(values.slice(index, index + ITEM_LOOKUP_VALUES_PER_REQUEST));
  }

  return chunks;
}

export function collectLineBarcodes(lines: readonly BCItemLookupInput[]): string[] {
  return uniqueNonBlank(lines.map((line) => line.eanNo));
}

export function collectItemNumbers(
  lines: readonly BCItemLookupInput[],
  references: readonly BCItemBarcodeReference[]
): string[] {
  return uniqueNonBlank([
    ...references.map((reference) => reference.itemNumber),
    ...lines.flatMap((line) => [line.itemNumber, line.custItemNo]),
  ]).filter((number) => number.length <= BC_ITEM_NUMBER_MAX_LENGTH);
}

export function mapLookupItem(raw: BCItemLookupItemRaw): BCItem {
  if (typeof raw.id !== "string") {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Business Central response field item.id must be a string"
    );
  }

  const variants = Array.isArray(raw.itemVariants) ? raw.itemVariants : [];

  return {
    id: raw.id,
    number: stringOrEmpty(raw.number),
    displayName: stringOrEmpty(raw.displayName),
    gtin: stringOrEmpty(raw.gtin),
    baseUnitOfMeasureCode: stringOrEmpty(raw.baseUnitOfMeasureCode),
    variants: variants.flatMap((variant: { id?: unknown; code?: unknown } | null) =>
      typeof variant?.id === "string"
        ? [{ id: variant.id, code: stringOrEmpty(variant.code) }]
        : []
    ),
  };
}

export function mapItemBarcodeReference(raw: BCItemReferenceRaw): BCItemBarcodeReference {
  return {
    barcode: stringOrEmpty(raw.Reference_No),
    itemNumber: stringOrEmpty(raw.Item_No),
    variantCode: stringOrEmpty(raw.Variant_Code),
    unitOfMeasureCode: stringOrEmpty(raw.Unit_of_Measure),
    referenceType: raw.Reference_Type === BC_BAR_CODE_REFERENCE_TYPE ? "bar_code" : "other",
  };
}
