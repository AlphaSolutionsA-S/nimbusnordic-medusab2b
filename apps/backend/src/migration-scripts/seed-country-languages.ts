import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { LEGACY_COUNTRY_LANGUAGES } from "../workflows/storefront-translation/utils/legacy-country-languages";
import { bootstrapCountryLanguagesWorkflow } from "../workflows/storefront-translation/workflows/bootstrap-country-languages";

/**
 * Deploy-time country-language bootstrap (Medusa Cloud cannot run `medusa exec`). Medusa runs
 * migration scripts in file-name order, so this one follows `initial-data-seed.ts` and a fresh
 * database has its regions first. Countries whose legacy language is missing or inactive are left
 * on English; an existing configuration is never overwritten. A failure (English unavailable)
 * throws, so Medusa does not record the script and runs it again on the next deploy.
 */
export default async function seedCountryLanguages({ container }: { container: MedusaContainer }) {
  const { result } = await bootstrapCountryLanguagesWorkflow(container).run({
    input: { legacy: LEGACY_COUNTRY_LANGUAGES, apply: true, skip_unavailable_languages: true },
  });
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const created = result.applied?.bootstrap.created ?? false;
  logger.info(
    `Country-language bootstrap: ${created ? "created" : "already initialized, existing configuration kept"}.`
  );
  const skipped = Object.entries(result.skipped);
  if (created && skipped.length) {
    logger.warn(
      `Country-language bootstrap skipped countries whose language is missing or inactive (they use English): ${skipped
        .map(([country, locale]) => `${country}→${locale}`)
        .join(", ")}.`
    );
  }
  return result;
}
