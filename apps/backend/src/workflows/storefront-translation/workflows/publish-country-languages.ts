import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { listConfiguredCountryCodesStep } from "../steps/list-configured-country-codes";
import { publishCountryLanguagesStep } from "../steps/publish-country-languages";

export const publishCountryLanguagesWorkflow = createWorkflow(
  "publish-country-languages",
  function () {
    const configured = listConfiguredCountryCodesStep();
    return new WorkflowResponse(publishCountryLanguagesStep(configured));
  }
);
