import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

export type ResolveBusinessCentralAccountInput =
  | { customerId: string; companyId?: never }
  | { companyId: string; customerId?: never };

export type BusinessCentralAccountCompanyRow = {
  id: string;
  business_central_customer_number: string | null;
  country: string | null;
};

const ACCOUNT_COMPANY_FIELDS = ["id", "business_central_customer_number", "country"] as const;

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

      return new StepResponse(company);
    }

    const {
      data: [customer],
    } = await query.graph({
      entity: "customer",
      fields: ACCOUNT_COMPANY_FIELDS.map((field) => `employee.company.${field}`),
      filters: { id: input.customerId },
    });

    return new StepResponse(customer?.employee?.company ?? null);
  }
);
