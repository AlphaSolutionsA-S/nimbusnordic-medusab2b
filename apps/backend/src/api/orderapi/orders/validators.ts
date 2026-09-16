import { z } from "@medusajs/framework/zod";

export const OrderApiOrdersQuerySchema = z
  .object({
    customerNumber: z.string().min(1),
  })
  .strict();

export type OrderApiOrdersQueryType = z.infer<typeof OrderApiOrdersQuerySchema>;
