import { z } from "@medusajs/framework/zod";

export const AdminShipmentTrackingQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(20),
  offset: z.coerce.number().int().min(0).max(2_147_483_647).default(0),
}).strict();
export type AdminShipmentTrackingQueryType = z.infer<typeof AdminShipmentTrackingQuery>;
export const AdminShipmentTrackingParams = z.object({
  id: z.string().regex(/^shtr_[a-zA-Z0-9]+$/).max(100),
}).strict();
export const AdminShipmentTrackingRetry = z.object({}).strict();
export type AdminShipmentTrackingRetryType = z.infer<typeof AdminShipmentTrackingRetry>;
