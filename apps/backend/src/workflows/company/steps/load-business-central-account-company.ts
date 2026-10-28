import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import type { BusinessCentralEnvironment } from "../../../modules/business-central/types";

export type ResolveBusinessCentralAccountInput =
  | { customerId: string; companyId?: never }
  | { companyId: string; customerId?: never };

export type BusinessCentralAccountCompanyRow = {
  id: string;
  business_central_customer_number: string | null;
  country: string | null;
  // ISO 8601: a step's output is serialised, so a Date would reach the workflow as a string anyway.
  business_central_not_found_at: string | null;
  business_central_not_found_environment: BusinessCentralEnvironment | null;
  business_central_not_found_customer_number: string | null;
};

// The company row as `query.graph` returns it: a dateTime column may be a Date or a string.
type RawAccountCompanyRow = Omit<
  BusinessCentralAccountCompanyRow,
  "business_central_not_found_at"
> & {
  business_central_not_found_at: Date | string | null;
};

const ACCOUNT_COMPANY_FIELDS = [
  "id",
  "business_central_customer_number",
  "country",
  "business_central_not_found_at",
  "business_central_not_found_environment",
  "business_central_not_found_customer_number",
] as const;

function toAccountCompanyRow(
  company: RawAccountCompanyRow | null | undefined
): BusinessCentralAccountCompanyRow | null {
  if (!company) {
    return null;
  }

  const notFoundAt = company.business_central_not_found_at;

  return {
    ...company,
    business_central_not_found_at: notFoundAt ? new Date(notFoundAt).toISOString() : null,
  };
}

export const loadBusinessCentralAccountCompanyStep = createStep(
  "load-business-central-account-company",
  async (
    input: ResolveBusinessCentralAccountInput,
    { container }
  ): Promise<StepResponse<BusinessCentralAccountCompanyRow | null>> => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    if (input.companyId !== undefined) {
      const {
        data: [company],
      } = await query.graph({
        entity: "company",
        fields: [...ACCOUNT_COMPANY_FIELDS],
        filters: { id: input.companyId },
      });

      if (!company) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Company with id ${input.companyId} was not found`
        );
      }

      return new StepResponse(toAccountCompanyRow(company));
    }

    // Deliberate `data-core-read-workflows` exemption: reads only our own company through the
    // customer's employee link, no core customer field.
    const {
      data: [customer],
    } = await query.graph({
      entity: "customer",
      fields: ACCOUNT_COMPANY_FIELDS.map((field) => `employee.company.${field}`),
      filters: { id: input.customerId },
    });

    return new StepResponse(toAccountCompanyRow(customer?.employee?.company));
  }
);
