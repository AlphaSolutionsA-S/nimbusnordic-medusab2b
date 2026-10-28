import { MedusaError } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import type {
  BusinessCentralEnvironment,
  IBusinessCentralModuleService,
} from "../../../modules/business-central/types";
import type { BusinessCentralAccountCompanyRow } from "./load-business-central-account-company";
import { requireBusinessCentralCustomerNumber } from "./lookup-business-central-customer";

export type ReadBusinessCentralCustomerCountryInput = {
  company: BusinessCentralAccountCompanyRow | null;
  environment: BusinessCentralEnvironment;
};

export type BusinessCentralCustomerCountryUpdate = {
  id: string;
  country: string;
};

// Re-reads the card on the server so the written country never comes from the client.
export const readBusinessCentralCustomerCountryStep = createStep(
  "read-business-central-customer-country",
  async (
    { company, environment }: ReadBusinessCentralCustomerCountryInput,
    { container }
  ): Promise<StepResponse<BusinessCentralCustomerCountryUpdate>> => {
    const { companyId, customerNumber } = requireBusinessCentralCustomerNumber(company);
    const bcService = container.resolve<IBusinessCentralModuleService>(BUSINESS_CENTRAL_MODULE);

    const card = await bcService.getCustomer(environment, customerNumber);

    if (!card) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `The Business Central customer was not found in environment ${environment}`
      );
    }

    return new StepResponse({ id: companyId, country: card.country });
  }
);
