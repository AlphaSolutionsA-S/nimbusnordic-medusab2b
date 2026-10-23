import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import { isCompanyEnabledForOrderApi } from "../../../utils/order-api-access";

export const CUSTOMER_NOT_FOUND_MESSAGE = "Customer not found";
export const CUSTOMER_NOT_REGISTERED_FOR_ORDER_API_MESSAGE =
  "Customer not registered for the order API";

export type ResolveCompanyByCustomerNumberInput = {
  customer_number: string;
};

export type ResolveCompanyByCustomerNumberOutput = {
  company_id: string;
};

type ResolvedCompanyRow = {
  id: string;
  order_api_enabled?: boolean | null;
};

/*
  Resolves the company behind a Business Central customer number for every order API endpoint.
  Read-only, so no compensation. An unknown number gets a fixed message: Medusa returns the
  message verbatim in the 404 body, and the caller must never see the number (NIMBUS-192).
  The number goes to one warn line only, with nothing else, as it may identify a sole trader.
  A known company switched off for the order API gets 403 with a fixed message, before any write
  or read by the calling workflow (NIMBUS-217); its warn line carries the company id only.
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
      fields: ["id", "order_api_enabled"],
      filters: { business_central_customer_number: input.customer_number },
    });

    const company: ResolvedCompanyRow | undefined = companies[0];

    if (!company) {
      const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
      logger.warn(`Order API: no company for customer number '${input.customer_number}'`);
      throw new MedusaError(MedusaError.Types.NOT_FOUND, CUSTOMER_NOT_FOUND_MESSAGE);
    }

    if (!isCompanyEnabledForOrderApi(company)) {
      const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
      logger.warn(`Order API: company '${company.id}' is not enabled for the order API`);
      throw new MedusaError(
        MedusaError.Types.FORBIDDEN,
        CUSTOMER_NOT_REGISTERED_FOR_ORDER_API_MESSAGE
      );
    }

    return new StepResponse({ company_id: company.id });
  }
);
