import { z } from "@medusajs/framework/zod";

const CANONICAL_DATE_PATTERN = /^(\d{2})-(\d{2})-(\d{4})$/;
const EAN_PATTERN = /^\d{13}$/;
const CURRENCY_CODE_PATTERN = /^[A-Za-z]{3}$/;

/*
  Dates arrive in the DD-MM-YYYY form the source EDI uses (<DocumentDate>27-08-2026</DocumentDate>).
  The pattern alone would accept impossible dates like 31-02-2026, so the value is also checked
  against the real calendar.
*/
function isRealCalendarDate(value: string): boolean {
  const match = CANONICAL_DATE_PATTERN.exec(value);

  if (!match) {
    return false;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const CanonicalDateSchema = z
  .string()
  .regex(CANONICAL_DATE_PATTERN, "must be a date in DD-MM-YYYY format")
  .refine(isRealCalendarDate, "must be a real calendar date");

export const CanonicalOrderAddressSchema = z
  .object({
    name: z.string().min(1),
    contact: z.string().optional(),
    addressLine1: z.string().min(1),
    addressLine2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().optional(),
    postCode: z.string().min(1),
    country: z.string().min(1),
  })
  .strict();

export type CanonicalOrderAddress = z.infer<typeof CanonicalOrderAddressSchema>;

export const CanonicalOrderLineSchema = z
  .object({
    lineNumber: z.number().int().nonnegative(),
    // itemNumber/description are optional pass-through traceability only: the line's item is
    // identified by eanNo, which Business Central resolves to a real item and whose own item
    // master supplies the description. In the real EDI samples itemNumber duplicates
    // custItemNo (the customer's own SKU), and nothing downstream resolves anything from it.
    itemNumber: z.string().min(1).optional(),
    custItemNo: z.string().optional(),
    eanNo: z.string().regex(EAN_PATTERN, "must be a 13-digit EAN/GTIN"),
    description: z.string().min(1).optional(),
    description2: z.string().optional(),
    unitOfMeasureCode: z.string().optional(),
    quantity: z.number().positive(),
    // Optional, and a stated expectation rather than an instruction: Business Central owns
    // customer pricing (sales prices / price lists / customer price groups), exactly as it does
    // today when these orders are keyed in by hand. A submitted price is retained for
    // discrepancy checking — it must not be passed to BC as a line-price override, or a stale
    // price in the customer's ordering system would silently beat the negotiated one.
    unitPrice: z.number().nonnegative().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    discountAmount: z.number().optional(),
    discountAppliedBeforeTax: z.boolean().optional(),
    taxCode: z.string().optional(),
    taxPercent: z.number().min(0).optional(),
    requestedShipmentDate: CanonicalDateSchema.optional(),
  })
  .strict();

export type CanonicalOrderLine = z.infer<typeof CanonicalOrderLineSchema>;

export const CanonicalOrderSchema = z
  .object({
    externalOrderNumber: z.string().min(1),
    orderDate: CanonicalDateSchema,
    requestedDeliveryDate: CanonicalDateSchema.optional(),
    currencyCode: z
      .string()
      .regex(CURRENCY_CODE_PATTERN, "must be a 3-letter ISO 4217 currency code"),
    salesperson: z.string().optional(),
    email: z.string().email().optional(),
    phoneNumber: z.string().optional(),
    discountAmount: z.number().optional(),
    discountAppliedBeforeTax: z.boolean().optional(),
    pricesIncludeTax: z.boolean().optional(),
    billTo: CanonicalOrderAddressSchema.optional(),
    shipTo: CanonicalOrderAddressSchema.optional(),
    // A repeated eanNo across lines is legitimate (same item, different delivery dates), but a
    // repeated lineNumber is not — it is the sender's identity for the line.
    lines: z
      .array(CanonicalOrderLineSchema)
      .min(1)
      .refine(
        (lines) =>
          new Set(lines.map((line) => line.lineNumber)).size === lines.length,
        "lineNumber must be unique within an order"
      ),
  })
  .strict();

export type CanonicalOrder = z.infer<typeof CanonicalOrderSchema>;
