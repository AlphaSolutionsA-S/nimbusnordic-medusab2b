import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { dismissMissingTranslationStep } from "../steps/dismiss-missing-translation";

export const dismissMissingTranslationWorkflow = createWorkflow(
  "dismiss-missing-translation",
  function (input: { locale: string; id: string }) {
    return new WorkflowResponse(dismissMissingTranslationStep(input));
  }
);
