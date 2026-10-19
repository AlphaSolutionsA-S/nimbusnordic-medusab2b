import { z } from "@medusajs/framework/zod";

// Strict, so a parameter the gateway should have dropped is a 400 rather than silently ignored.
export const OrderApiShipmentNoticesQuerySchema = z
  .object({
    customerNumber: z.string().min(1),
    // At most 15 digits keeps the cursor an exact JavaScript number.
    after: z
      .string()
      .regex(/^(0|[1-9]\d{0,14})$/, "must be a decimal cursor of at most 15 digits")
      .optional(),
    since: z.iso.datetime({ offset: true }).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict()
  .refine((query) => query.after === undefined || query.since === undefined, {
    message: "after and since cannot be combined",
  });

export type OrderApiShipmentNoticesQuery = z.infer<typeof OrderApiShipmentNoticesQuerySchema>;
