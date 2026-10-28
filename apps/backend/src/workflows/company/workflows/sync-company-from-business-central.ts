import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import type { ModuleUpdateCompany } from "../../../types";
import { loadBusinessCentralAccountCompanyStep } from "../steps/load-business-central-account-company";
import { prepareCompanyBcSyncStep } from "../steps/prepare-company-bc-sync";
import { updateCompaniesStep } from "../steps/update-companies";

export type SyncCompanyFromBusinessCentralInput =
  | { customerId: string; expectedCompanyId?: string; companyId?: never }
  | { companyId: string; customerId?: never; expectedCompanyId?: never };

export type SyncCompanyFromBusinessCentralResult = {
  status: "updated" | "skipped" | "failed";
};

export const syncCompanyFromBusinessCentralWorkflow = createWorkflow(
  "sync-company-from-business-central",
  function (input: SyncCompanyFromBusinessCentralInput) {
    // An unknown company id rejects here as not_found; a customer without a company loads null.
    const company = loadBusinessCentralAccountCompanyStep(input);
    const prepared = prepareCompanyBcSyncStep({
      company,
      expectedCompanyId: input.expectedCompanyId,
    });

    // One company update writes either the synced card (clearing the not-found record) or the
    // not-found record alone.
    when(
      { prepared },
      ({ prepared }) =>
        prepared.status === "ready" || prepared.status === "not_found"
    ).then(() => {
      const update = transform(
        { prepared },
        ({ prepared }) => prepared.update as ModuleUpdateCompany
      );

      updateCompaniesStep(update);
    });

    // Not found keeps reporting `skipped` so the store and Admin sync responses keep their three
    // values (docs/architecture/business-central-company-sync.md, "A new outcome").
    const result = transform(
      { prepared },
      ({ prepared }): SyncCompanyFromBusinessCentralResult => {
        switch (prepared.status) {
          case "ready":
            return { status: "updated" };
          case "not_found":
            return { status: "skipped" };
          default:
            return { status: prepared.status };
        }
      }
    );

    return new WorkflowResponse(result);
  }
);
