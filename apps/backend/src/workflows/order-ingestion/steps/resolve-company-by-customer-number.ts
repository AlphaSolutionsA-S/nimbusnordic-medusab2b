import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";

export const CUSTOMER_NOT_FOUND_MESSAGE = "Customer not found";

export type ResolveCompanyByCustomerNumberInput = {
  customer_number: string;
};

export type ResolveCompanyByCustomerNumberOutput = {
  company_id: string;
};

/*
  Resolves the company behind a Business Central customer number for every order API endpoint.
  Read-only, so no compensation. An unknown number gets a fixed message: Medusa returns the
  message verbatim in the 404 body, and the caller must never see the number (NIMBUS-192).
  The number goes to one warn line only, with nothing else, as it may identify a sole trader.
*/
export const resolveCompanyByCustomerNumberStep = createStep(
  "resolve-company-by-customer-number",
  async (
    input: ResolveCompanyByCustomerNumberInput,
    { container }
  ): Promise<StepResponse<ResolveCompanyByCustomerNumberOutput>> => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const { data: companies } = await query.graph({
      entity: "companies",
      fields: ["id"],
      filters: { business_central_customer_number: input.customer_number },
    });

    const company = companies[0];

    if (!company) {
      const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
      logger.warn(`Order API: no company for customer number '${input.customer_number}'`);
      throw new MedusaError(MedusaError.Types.NOT_FOUND, CUSTOMER_NOT_FOUND_MESSAGE);
    }

    return new StepResponse({ company_id: company.id });
  }
);
