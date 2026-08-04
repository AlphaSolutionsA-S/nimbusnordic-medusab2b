import { z } from "@medusajs/framework/zod";

export const StoreUpdatePassword = z
  .object({
    old_password: z.string().min(1),
    new_password: z.string().min(8),
  })
  .strict();

export type StoreUpdatePasswordType = z.infer<typeof StoreUpdatePassword>;
