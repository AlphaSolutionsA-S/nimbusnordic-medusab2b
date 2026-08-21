import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import type { ModuleUpdateCompany } from "../../../types";
import { prepareCompanyBcSyncStep } from "../steps/prepare-company-bc-sync";
import { updateCompaniesStep } from "../steps/update-companies";

export type SyncCompanyFromBusinessCentralInput = {
  customerId: string;
};

export type SyncCompanyFromBusinessCentralResult = {
  status: "updated" | "skipped" | "failed";
};

export const syncCompanyFromBusinessCentralWorkflow = createWorkflow(
  "sync-company-from-business-central",
  function (input: SyncCompanyFromBusinessCentralInput) {
    const prepared = prepareCompanyBcSyncStep({
      customerId: input.customerId,
    });

    when({ prepared }, ({ prepared }) => prepared.status === "ready").then(
      () => {
        const update = transform(
          { prepared },
          ({ prepared }) => prepared.update as ModuleUpdateCompany
        );

        updateCompaniesStep(update);
      }
    );

    const result = transform({ prepared }, ({ prepared }) => ({
      status: prepared.status === "ready" ? "updated" : prepared.status,
    }));

    return new WorkflowResponse(result);
  }
);
