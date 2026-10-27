import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";

import { loadBusinessCentralAccountCompanyStep } from "../steps/load-business-central-account-company";
import {
  type BusinessCentralCustomerLookup,
  lookupBusinessCentralCustomerStep,
} from "../steps/lookup-business-central-customer";

export type { BusinessCentralCustomerLookup };

export type LookupBusinessCentralCustomerInput = { companyId: string };

export const lookupBusinessCentralCustomerWorkflow = createWorkflow(
  "lookup-business-central-customer",
  function (input: LookupBusinessCentralCustomerInput) {
    const company = loadBusinessCentralAccountCompanyStep({ companyId: input.companyId });

    return new WorkflowResponse(lookupBusinessCentralCustomerStep(company));
  }
);
