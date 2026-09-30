import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { reportMissingTranslationsStep } from "../steps/report-missing-translations";
import type { MissingReport } from "../../../types/storefront-translation";

export const reportMissingTranslationsWorkflow = createWorkflow(
  "report-missing-translations",
  function (input: MissingReport[]) {
    return new WorkflowResponse(reportMissingTranslationsStep(input));
  }
);
