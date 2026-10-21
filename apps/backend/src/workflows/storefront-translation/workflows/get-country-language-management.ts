import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { getCountryLanguageManagementStep } from "../steps/get-country-language-management";
import { listConfiguredCountryCodesStep } from "../steps/list-configured-country-codes";

export const getCountryLanguageManagementWorkflow = createWorkflow(
  "get-country-language-management",
  function () {
    const configured = listConfiguredCountryCodesStep();
    return new WorkflowResponse(getCountryLanguageManagementStep(configured));
  }
);
