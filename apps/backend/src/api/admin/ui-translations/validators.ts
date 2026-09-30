import { z } from "@medusajs/framework/zod";
import {
  localeSchema,
  MAX_VALUE_BYTES,
  messageDocumentSchema,
} from "../../../utils/translations/validation";

const versionSchema = z.number().int().positive();

export const CreateTranslationSchema = z.discriminatedUnion("source", [
  z
    .object({
      locale: localeSchema,
      source: z.literal("copy"),
      source_locale: localeSchema,
      source_version: versionSchema,
    })
    .strict(),
  z
    .object({
      locale: localeSchema,
      source: z.literal("import"),
      messages: messageDocumentSchema,
    })
    .strict(),
]);
export type CreateTranslationBody = z.infer<typeof CreateTranslationSchema>;

export const SaveTranslationSchema = z
  .object({ expected_version: versionSchema, messages: messageDocumentSchema })
  .strict();
export type SaveTranslationBody = z.infer<typeof SaveTranslationSchema>;

export const ImportPreviewSchema = z
  .object({
    expected_version: versionSchema.nullable(),
    mode: z.enum(["merge", "replace"]),
    messages: messageDocumentSchema,
  })
  .strict();
export type ImportPreviewBody = z.infer<typeof ImportPreviewSchema>;

export const ImportTranslationSchema = z
  .object({
    expected_version: versionSchema.nullable(),
    mode: z.enum(["merge", "replace"]),
    messages: messageDocumentSchema,
    confirm_removed: z.boolean().default(false),
  })
  .strict();
export type ImportTranslationBody = z.infer<typeof ImportTranslationSchema>;

export const ActivationSchema = z
  .object({ expected_version: versionSchema, is_active: z.boolean() })
  .strict();
export type ActivationBody = z.infer<typeof ActivationSchema>;

export const ResolveMissingSchema = z
  .object({
    expected_version: versionSchema,
    value: z
      .string()
      .max(MAX_VALUE_BYTES)
      .refine((value) => value.trim() !== "", "Enter a text value"),
  })
  .strict();
export type ResolveMissingBody = z.infer<typeof ResolveMissingSchema>;

export const DismissMissingSchema = z.object({}).strict();

export const MissingListQuerySchema = z
  .object({
    locale: localeSchema.optional(),
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type MissingListQuery = z.infer<typeof MissingListQuerySchema>;

export const MissingIdSchema = z.string().min(1).max(64).regex(/^trmk_[0-9A-Za-z]+$/);
