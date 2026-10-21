import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { assignCountryLanguageStep } from "../steps/assign-country-language";
import { getCountryLanguageManagementStep } from "../steps/get-country-language-management";
import { listConfiguredCountryCodesStep } from "../steps/list-configured-country-codes";

export interface AssignCountryLanguageWorkflowInput {
  country_code: string;
  locale: string;
  expected_version: number;
}

/** Saves one country's language against current Region membership; returns the management view. */
export const assignCountryLanguageWorkflow = createWorkflow(
  "assign-country-language",
  function (input: AssignCountryLanguageWorkflowInput) {
    const configured = listConfiguredCountryCodesStep();
    const assignment = transform({ input, configured }, ({ input, configured }) => ({
      country_code: input.country_code,
      locale: input.locale,
      expected_version: input.expected_version,
      configured_country_codes: configured,
    }));
    assignCountryLanguageStep(assignment);
    return new WorkflowResponse(getCountryLanguageManagementStep(configured));
  }
);
