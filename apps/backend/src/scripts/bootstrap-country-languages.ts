import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { LEGACY_COUNTRY_LANGUAGES } from "../workflows/storefront-translation/utils/legacy-country-languages";
import { bootstrapCountryLanguagesWorkflow } from "../workflows/storefront-translation/workflows/bootstrap-country-languages";

const USAGE = "Usage: medusa exec ./src/scripts/bootstrap-country-languages.ts [apply]";

/**
 * `apply` is a bare positional because `medusa exec` declares `exec [file] [args..]` under yargs
 * `.strict()`, which rejects an unknown `--apply` option before the script loads. Anything else is
 * refused, so a mistyped switch never looks like a successful apply.
 */
export function bootstrapMode(args: readonly string[]): "apply" | "dry-run" {
  if (args.length === 0) return "dry-run";
  if (args.length === 1 && args[0] === "apply") return "apply";
  throw new MedusaError(MedusaError.Types.INVALID_ARGUMENT, `Unexpected arguments ${JSON.stringify(args)}. ${USAGE}`);
}

/**
 * Operator rollout step, run once per environment:
 *   npx medusa exec ./src/scripts/bootstrap-country-languages.ts          (dry run, no writes)
 *   npx medusa exec ./src/scripts/bootstrap-country-languages.ts apply    (initialize)
 * The dry run lists the proposed assignments and every language that must be active first.
 * Apply never overwrites an existing configuration, so repeating it keeps Admin edits.
 */
export default async function bootstrapCountryLanguages({ container, args = [] }: ExecArgs) {
  const mode = bootstrapMode(args);
  const apply = mode === "apply";
  const { result } = await bootstrapCountryLanguagesWorkflow(container).run({
    input: { legacy: LEGACY_COUNTRY_LANGUAGES, apply },
  });
  const summary = { mode, ...result };
  container
    .resolve(ContainerRegistrationKeys.LOGGER)
    .info(`Country-language bootstrap: ${JSON.stringify(summary)}`);
  return summary;
}
