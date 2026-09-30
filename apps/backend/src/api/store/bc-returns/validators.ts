import { z } from "@medusajs/framework/zod";

export type StoreBCReturnsQueryType = z.infer<typeof StoreBCReturnsQuery>;

export const StoreBCReturnsQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    state: z.enum(["open", "processed"]).optional(),
    date_from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "date_from must be YYYY-MM-DD")
      .optional(),
    date_to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "date_to must be YYYY-MM-DD")
      .optional(),
    search: z.string().max(200).optional(),
  })
  .strict();
