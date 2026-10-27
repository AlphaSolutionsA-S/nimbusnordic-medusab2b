import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import type { BusinessCentralEnvironment } from "../../../modules/business-central/types";
import { getBusinessCentralEnvironmentForCountry } from "../../../utils/business-central-environment";
import {
  loadBusinessCentralAccountCompanyStep,
  type ResolveBusinessCentralAccountInput,
} from "../steps/load-business-central-account-company";

export type { ResolveBusinessCentralAccountInput };

export type BusinessCentralNotFoundRecord = {
  at: Date;
  environment: BusinessCentralEnvironment;
  customerNumber: string;
};

export type BusinessCentralAccount = {
  companyId: string | null;
  customerNumber: string | null;
  environment: BusinessCentralEnvironment;
  notFound: BusinessCentralNotFoundRecord | null;
};

export const resolveBusinessCentralAccountWorkflow = createWorkflow(
  "resolve-business-central-account",
  function (input: ResolveBusinessCentralAccountInput) {
    const company = loadBusinessCentralAccountCompanyStep(input);

    const account = transform(
      { company },
      ({ company }): BusinessCentralAccount => ({
        companyId: company?.id ?? null,
        customerNumber: company?.business_central_customer_number ?? null,
        environment: getBusinessCentralEnvironmentForCountry(company?.country),
        notFound: null,
      })
    );

    return new WorkflowResponse(account);
  }
);
