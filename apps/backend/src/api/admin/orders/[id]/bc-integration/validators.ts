import { z } from "@medusajs/framework/zod";
export const AdminSubmitOrderToBc = z
  .object({ force_resend: z.boolean().optional().default(false) })
  .strict();
export type AdminSubmitOrderToBcType = z.infer<typeof AdminSubmitOrderToBc>;
