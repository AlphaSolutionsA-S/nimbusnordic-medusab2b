import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { CountryLanguageAssignments } from "../types/storefront-translation";
import { bootstrapCountryLanguagesWorkflow } from "../workflows/storefront-translation/workflows/bootstrap-country-languages";

/**
 * Country languages the storefront used before the configuration existed (its legacy
 * country-to-locale map). Copied rather than imported: the apps share no source. Countries
 * without an entry (and outside Region membership) fall back to the English default.
 */
export const LEGACY_COUNTRY_LANGUAGES: CountryLanguageAssignments = {
  dk: "da",
  gb: "en",
  se: "sv",
  no: "no",
  pl: "pl",
  it: "it",
  fr: "fr",
  de: "de",
};

/**
 * Operator rollout step, run once per environment:
 *   npx medusa exec ./src/scripts/bootstrap-country-languages.ts            (dry run, no writes)
 *   npx medusa exec ./src/scripts/bootstrap-country-languages.ts --apply    (initialize)
 * The dry run lists the proposed assignments and every language that must be active first.
 * Apply never overwrites an existing configuration, so repeating it keeps Admin edits.
 */
export default async function bootstrapCountryLanguages({ container, args = [] }: ExecArgs) {
  const apply = args.includes("--apply");
  const { result } = await bootstrapCountryLanguagesWorkflow(container).run({
    input: { legacy: LEGACY_COUNTRY_LANGUAGES, apply },
  });
  const summary = { mode: apply ? ("apply" as const) : ("dry-run" as const), ...result };
  container
    .resolve(ContainerRegistrationKeys.LOGGER)
    .info(`Country-language bootstrap: ${JSON.stringify(summary)}`);
  return summary;
}
