import { z } from "@medusajs/framework/zod";

/*
  Wire contract of GET /orderapi/shipment-notices (NIMBUS-130). The customer-facing JSON Schema and
  the XSD of the XML rendering APIM produces mirror these schemas; change them together. Null fields
  are null in JSON and omitted in XML.
*/

// Cursors are opaque to the customer; on the wire they are decimal strings.
const CursorSchema = z.string().regex(/^(0|[1-9]\d*)$/, "must be a decimal string");

const ShipmentDateSchema = z.iso.date();

export const SHIPMENT_NOTICE_STATUSES = ["shipped", "revised", "cancelled"] as const;

export const ShipmentNoticeStatusSchema = z.enum(SHIPMENT_NOTICE_STATUSES);

export type ShipmentNoticeStatus = z.infer<typeof ShipmentNoticeStatusSchema>;

export const ShipmentNoticePartySchema = z
  .object({
    customer_number: z.string().nullable(),
    name: z.string().nullable(),
    address_line_1: z.string().nullable(),
    address_line_2: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    post_code: z.string().nullable(),
    country: z.string().nullable(),
  })
  .strict();

export const ShipmentNoticeShipToSchema = z
  .object({
    name: z.string().nullable(),
    contact: z.string().nullable(),
    address_line_1: z.string().nullable(),
    address_line_2: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    post_code: z.string().nullable(),
    country: z.string().nullable(),
  })
  .strict();

export const ShipmentNoticeLineSchema = z
  .object({
    // The customer's own line number and EAN; null when the order line could not be matched.
    line_number: z.number().int().nonnegative().nullable(),
    ean_no: z.string().nullable(),
    bc_line_number: z.number().int().nonnegative(),
    item_number: z.string().min(1),
    // BC variant code (the size) of the posted line; null for an item without variants (NIMBUS-231).
    variant_code: z.string().nullable(),
    description: z.string().nullable(),
    description_2: z.string().nullable(),
    unit_of_measure_code: z.string().nullable(),
    // Net of undo corrections, so 0 for an undone line.
    quantity: z.number().nonnegative(),
    shipment_date: ShipmentDateSchema,
  })
  .strict();

export type ShipmentNoticeLine = z.infer<typeof ShipmentNoticeLineSchema>;

export const ShipmentNoticeSchema = z
  .object({
    cursor: CursorSchema,
    previous_cursor: CursorSchema.nullable(),
    recorded_at: z.iso.datetime(),
    revision: z.number().int().positive(),
    status: ShipmentNoticeStatusSchema,
    order_id: z.string().min(1),
    external_order_number: z.string().min(1),
    bc_order_number: z.string().min(1),
    shipment_number: z.string().min(1),
    shipment_date: ShipmentDateSchema,
    shipment_method_code: z.string().nullable(),
    your_reference: z.string().nullable(),
    sell_to: ShipmentNoticePartySchema,
    bill_to: ShipmentNoticePartySchema,
    ship_to: ShipmentNoticeShipToSchema,
    lines: z.array(ShipmentNoticeLineSchema).min(1),
  })
  .strict();

export type ShipmentNotice = z.infer<typeof ShipmentNoticeSchema>;

// The stored `shipment_notice.payload`: the fields that are row columns are left out.
export const ShipmentNoticePayloadSchema = ShipmentNoticeSchema.omit({
  cursor: true,
  previous_cursor: true,
  recorded_at: true,
  revision: true,
  status: true,
});

export type ShipmentNoticePayload = z.infer<typeof ShipmentNoticePayloadSchema>;

export const ShipmentNoticeEnvelopeSchema = z
  .object({
    shipment_notices: z.array(ShipmentNoticeSchema),
    next_cursor: CursorSchema.nullable(),
    has_more: z.boolean(),
  })
  .strict();

export type ShipmentNoticeEnvelope = z.infer<typeof ShipmentNoticeEnvelopeSchema>;

// Medusa's error handler body (`@medusajs/framework` error-handler: `code` is absent when unset).
export const MedusaErrorBodySchema = z
  .object({
    type: z.string(),
    message: z.string(),
    code: z.string().optional(),
  })
  .strict();

// Errors raised before Medusa: the Logic App's 401s and APIM's own errors.
export const GatewayErrorBodySchema = z
  .object({
    error: z.string(),
    message: z.string().optional(),
  })
  .strict();

export const ShipmentNoticeErrorBodySchema = z.union([
  MedusaErrorBodySchema,
  GatewayErrorBodySchema,
]);

export type ShipmentNoticeErrorBody = z.infer<typeof ShipmentNoticeErrorBodySchema>;
