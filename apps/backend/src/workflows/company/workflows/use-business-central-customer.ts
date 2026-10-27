import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk";

import type { BusinessCentralEnvironment } from "../../../modules/business-central/types";
import { loadBusinessCentralAccountCompanyStep } from "../steps/load-business-central-account-company";
import { readBusinessCentralCustomerCountryStep } from "../steps/read-business-central-customer-country";
import { updateCompaniesStep } from "../steps/update-companies";
import {
  syncCompanyFromBusinessCentralWorkflow,
  type SyncCompanyFromBusinessCentralResult,
} from "./sync-company-from-business-central";

export type UseBusinessCentralCustomerInput = {
  companyId: string;
  environment: BusinessCentralEnvironment;
};

export type UseBusinessCentralCustomerResult = SyncCompanyFromBusinessCentralResult & {
  country: string;
};

export const useBusinessCentralCustomerWorkflow = createWorkflow(
  "use-business-central-customer",
  function (input: UseBusinessCentralCustomerInput) {
    const company = loadBusinessCentralAccountCompanyStep({ companyId: input.companyId });
    const countryUpdate = readBusinessCentralCustomerCountryStep({
      company,
      environment: input.environment,
    });

    // The country came from the card just read, so it stays when the sync below reports failed
    // (NIMBUS-261); the step's compensation restores it only if the workflow itself fails.
    updateCompaniesStep(countryUpdate).config({
      name: "update-company-country-from-business-central",
    });

    const sync = syncCompanyFromBusinessCentralWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({ companyId: input.companyId })),
    });

    const result = transform(
      { sync, countryUpdate },
      ({ sync, countryUpdate }): UseBusinessCentralCustomerResult => ({
        status: sync.status,
        country: countryUpdate.country,
      })
    );

    return new WorkflowResponse(result);
  }
);
