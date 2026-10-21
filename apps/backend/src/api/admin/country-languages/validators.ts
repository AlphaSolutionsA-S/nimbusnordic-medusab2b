import { z } from "@medusajs/framework/zod";
import { localeSchema } from "../../../utils/translations/validation";

export const AssignCountryLanguageSchema = z
  .object({
    locale: localeSchema,
    expected_version: z.number().int().positive(),
  })
  .strict();
export type AssignCountryLanguageBody = z.infer<typeof AssignCountryLanguageSchema>;

/** Lower-case ISO 3166-1 alpha-2, the form Medusa Regions store. */
export const CountryCodeSchema = z
  .string()
  .regex(/^[a-z]{2}$/, "Country must be a lower-case two-letter ISO code");
