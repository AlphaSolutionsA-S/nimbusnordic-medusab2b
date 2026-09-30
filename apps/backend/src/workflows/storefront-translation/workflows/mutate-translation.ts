import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { mutateTranslationStep } from "../steps/mutate-translation";
import type { MutationInput } from "../../../types/storefront-translation";

export const mutateTranslationWorkflow = createWorkflow(
  "mutate-translation",
  function (input: MutationInput) {
    return new WorkflowResponse(mutateTranslationStep(input));
  }
);
