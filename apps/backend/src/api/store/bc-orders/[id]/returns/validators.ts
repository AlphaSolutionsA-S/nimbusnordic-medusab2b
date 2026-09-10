import { z } from "@medusajs/framework/zod";

export const StoreCreateBCReturn = z
  .object({
    lines: z
      .array(
        z
          .object({
            source_line_no: z.number().int().positive(),
            quantity: z.number().positive().max(1_000_000),
            return_reason_code: z.string().min(1).max(50),
          })
          .strict()
      )
      .min(1)
      .max(50),
  })
  .strict()
  .superRefine((value, context) => {
    const sourceLineNumbers = value.lines.map((line) => line.source_line_no);

    if (new Set(sourceLineNumbers).size !== sourceLineNumbers.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate source_line_no is not allowed.",
      });
    }
  });

export type StoreCreateBCReturnType = z.infer<typeof StoreCreateBCReturn>;
