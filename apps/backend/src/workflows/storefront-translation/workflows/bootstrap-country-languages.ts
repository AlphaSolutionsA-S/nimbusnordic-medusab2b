import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import type { CountryLanguageAssignments } from "../../../types/storefront-translation";
import { bootstrapCountryLanguagesStep } from "../steps/bootstrap-country-languages";
import { listConfiguredCountryCodesStep } from "../steps/list-configured-country-codes";
import { previewCountryLanguageBootstrapStep } from "../steps/preview-country-language-bootstrap";
import { publishCountryLanguagesStep } from "../steps/publish-country-languages";
import {
  bootstrapAssignments,
  skipUnavailableAssignments,
} from "../utils/country-language-scope";

export interface BootstrapCountryLanguagesWorkflowInput {
  /** Country languages in use before the configuration existed. */
  legacy: CountryLanguageAssignments;
  /** False reports prerequisites only; true also initializes when absent and reads back. */
  apply: boolean;
  /**
   * True leaves out countries whose language is missing or inactive (they use English) instead of
   * refusing; the deploy migration script sets it, the operator script does not.
   */
  skip_unavailable_languages?: boolean;
}

/**
 * Rollout gate: always reports the proposed assignments and unavailable languages; only an
 * explicit apply inserts the configuration (never overwriting one) and reads the publication back.
 */
export const bootstrapCountryLanguagesWorkflow = createWorkflow(
  "bootstrap-country-languages",
  function (input: BootstrapCountryLanguagesWorkflowInput) {
    const configured = listConfiguredCountryCodesStep();
    const assignments = transform({ input, configured }, ({ input, configured }) =>
      bootstrapAssignments(input.legacy, configured)
    );
    const report = previewCountryLanguageBootstrapStep(assignments);
    const scoped = transform({ input, assignments, report }, ({ input, assignments, report }) =>
      skipUnavailableAssignments(
        assignments,
        input.skip_unavailable_languages ? report.unavailable_locales : []
      )
    );
    const applied = when(
      "apply-country-language-bootstrap",
      { input },
      ({ input }) => input.apply
    ).then(() => {
      const bootstrap = bootstrapCountryLanguagesStep(scoped.assignments);
      const publication = publishCountryLanguagesStep(configured);
      return { bootstrap, publication };
    });
    return new WorkflowResponse({
      configured_country_codes: configured,
      assignments,
      report,
      skipped: scoped.skipped,
      applied,
    });
  }
);
