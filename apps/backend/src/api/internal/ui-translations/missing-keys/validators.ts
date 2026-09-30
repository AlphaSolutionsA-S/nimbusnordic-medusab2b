import { z } from "@medusajs/framework/zod";
import {
  keyPathProblem,
  localeSchema,
  MAX_KEY_LENGTH,
  MAX_REPORT_BATCH,
  MAX_REPORT_PATH_LENGTH,
} from "../../../../utils/translations/validation";

const pagePathSchema = z.string().min(1).max(MAX_REPORT_PATH_LENGTH).startsWith("/");

export const MissingReportSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("key"),
      locale: localeSchema,
      page_path: pagePathSchema,
      key: z
        .string()
        .max(MAX_KEY_LENGTH)
        .refine((key) => keyPathProblem(key) === null, "Invalid message key"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("locale_unavailable"),
      locale: localeSchema,
      page_path: pagePathSchema,
    })
    .strict(),
]);

export const MissingReportBatchSchema = z
  .object({ reports: z.array(MissingReportSchema).min(1).max(MAX_REPORT_BATCH) })
  .strict();
export type MissingReportBatch = z.infer<typeof MissingReportBatchSchema>;
