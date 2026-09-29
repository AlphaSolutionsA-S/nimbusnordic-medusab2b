import { z } from "@medusajs/framework/zod";
import { CanonicalDateSchema } from "./canonical-order-schema";

/**
 * The `Order.metadata` key holding the verbatim canonical order JSON written by
 * `createIngestedOrderStep` (src/workflows/order-ingestion/steps/create-ingested-order.ts). It is
 * the only source of order-line detail: these orders have no `OrderLineItem` records.
 */
export const CANONICAL_ORDER_METADATA_KEY = "canonical_order";

/**
 * The `Order.metadata` key holding the matched Medusa company id, written by the same step.
 */
export const COMPANY_ID_METADATA_KEY = "company_id";

/**
 * Deliberately NARROW and NON-STRICT view of the canonical order: only the fields NIMBUS-148 sends
 * to Business Central. Plain `z.object` strips unknown keys instead of rejecting them, so pricing,
 * discount, tax and description fields (which are not sent — see PLAN.md Decision 6) and any field
 * NIMBUS-147 adds later do not break parsing. Do NOT add `.strict()`.
 */
export const BcOrderPayloadAddressSchema = z.object({
  name: z.string().optional(),
  contact: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postCode: z.string().optional(),
  country: z.string().optional(),
});

export type BcOrderPayloadAddress = z.infer<typeof BcOrderPayloadAddressSchema>;

export const BcOrderPayloadLineSchema = z.object({
  lineNumber: z.number(),
  eanNo: z.string(),
  itemNumber: z.string().optional(),
  custItemNo: z.string().optional(),
  unitOfMeasureCode: z.string().optional(),
  quantity: z.number(),
  requestedShipmentDate: CanonicalDateSchema.optional(),
});

export type BcOrderPayloadLine = z.infer<typeof BcOrderPayloadLineSchema>;

export const BcOrderPayloadSchema = z.object({
  externalOrderNumber: z.string(),
  orderDate: CanonicalDateSchema,
  currencyCode: z.string(),
  requestedDeliveryDate: CanonicalDateSchema.optional(),
  email: z.string().optional(),
  phoneNumber: z.string().optional(),
  billTo: BcOrderPayloadAddressSchema.optional(),
  shipTo: BcOrderPayloadAddressSchema.optional(),
  lines: z.array(BcOrderPayloadLineSchema).min(1),
});

export type BcOrderPayload = z.infer<typeof BcOrderPayloadSchema>;

export type BcOrderPayloadParseResult =
  | { ok: true; payload: BcOrderPayload }
  | { ok: false; message: string };

/**
 * Reads the canonical order payload out of an untrusted `Order.metadata` value.
 *
 * Returns a result rather than throwing: a missing or malformed payload is a recordable submission
 * failure (status `failed`, Task 04), not an exception that would leave the state at `pending`.
 */
export function parseBcOrderPayload(
  metadata: Record<string, unknown> | null | undefined
): BcOrderPayloadParseResult {
  const raw = metadata?.[CANONICAL_ORDER_METADATA_KEY];

  if (raw === undefined || raw === null) {
    return {
      ok: false,
      message: `Order metadata has no '${CANONICAL_ORDER_METADATA_KEY}' payload`,
    };
  }

  const parsed = BcOrderPayloadSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      message: `Order metadata '${CANONICAL_ORDER_METADATA_KEY}' payload is not a usable canonical order`,
    };
  }

  return { ok: true, payload: parsed.data };
}

/**
 * Reads the matched company id out of an untrusted `Order.metadata` value.
 */
export function readCompanyIdFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const raw = metadata?.[COMPANY_ID_METADATA_KEY];

  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

/**
 * Converts a canonical `DD-MM-YYYY` date (already validated by `CanonicalDateSchema`) into the
 * `YYYY-MM-DD` form Business Central's `Edm.Date` fields require.
 */
export function canonicalDateToBcDate(value: string): string {
  const [day, month, year] = value.split("-");

  return `${year}-${month}-${day}`;
}
