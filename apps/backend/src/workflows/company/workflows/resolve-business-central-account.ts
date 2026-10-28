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
  // ISO 8601: Medusa serialises a workflow's result, so it never returns a Date.
  at: string;
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
        // The sync writes and clears the three columns together.
        notFound:
          company?.business_central_not_found_at &&
          company.business_central_not_found_environment &&
          company.business_central_not_found_customer_number
            ? {
                at: company.business_central_not_found_at,
                environment: company.business_central_not_found_environment,
                customerNumber: company.business_central_not_found_customer_number,
              }
            : null,
      })
    );

    return new WorkflowResponse(account);
  }
);
