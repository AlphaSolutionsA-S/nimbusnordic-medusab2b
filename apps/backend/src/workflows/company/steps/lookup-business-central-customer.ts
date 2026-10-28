import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import type {
  BCCustomer,
  BusinessCentralEnvironment,
  IBusinessCentralModuleService,
} from "../../../modules/business-central/types";
import { getBusinessCentralEnvironmentForCountry } from "../../../utils/business-central-environment";
import type { BusinessCentralAccountCompanyRow } from "./load-business-central-account-company";

// Only what the admin needs to pick a card: no address, contact, VAT or credit data.
export type BusinessCentralLookupCustomer = {
  name: string;
  country: string;
  routesTo: BusinessCentralEnvironment;
  routesElsewhere: boolean;
};

export type BusinessCentralLookupResult = {
  environment: BusinessCentralEnvironment;
  status: "found" | "not_found" | "could_not_check";
  customer: BusinessCentralLookupCustomer | null;
};

export type BusinessCentralCustomerLookup = {
  customerNumber: string;
  results: BusinessCentralLookupResult[];
};

const LOOKUP_ENVIRONMENTS: readonly BusinessCentralEnvironment[] = ["DK", "NO"];

export function requireBusinessCentralCustomerNumber(
  company: BusinessCentralAccountCompanyRow | null
): { companyId: string; customerNumber: string } {
  if (!company?.business_central_customer_number) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The company has no Business Central customer number"
    );
  }

  return { companyId: company.id, customerNumber: company.business_central_customer_number };
}

function toLookupResult(
  environment: BusinessCentralEnvironment,
  card: BCCustomer | null
): BusinessCentralLookupResult {
  if (!card) {
    return { environment, status: "not_found", customer: null };
  }

  const routesTo = getBusinessCentralEnvironmentForCountry(card.country);

  return {
    environment,
    status: "found",
    customer: {
      name: card.displayName,
      country: card.country,
      routesTo,
      routesElsewhere: routesTo !== environment,
    },
  };
}

// Read-only: checks the number in both environments regardless of where the company routes today.
export const lookupBusinessCentralCustomerStep = createStep(
  "lookup-business-central-customer",
  async (
    company: BusinessCentralAccountCompanyRow | null,
    { container }
  ): Promise<StepResponse<BusinessCentralCustomerLookup>> => {
    const { companyId, customerNumber } = requireBusinessCentralCustomerNumber(company);
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const bcService = container.resolve<IBusinessCentralModuleService>(BUSINESS_CENTRAL_MODULE);

    const settled = await Promise.allSettled(
      LOOKUP_ENVIRONMENTS.map((environment) => bcService.getCustomer(environment, customerNumber))
    );

    const results = settled.map((outcome, index): BusinessCentralLookupResult => {
      const environment = LOOKUP_ENVIRONMENTS[index];

      if (outcome.status === "fulfilled") {
        return toLookupResult(environment, outcome.value);
      }

      // The error may carry BC response detail; the log names only the company and environment.
      logger.warn(
        `Business Central customer check failed for company ${companyId} (environment ${environment})`
      );
      return { environment, status: "could_not_check", customer: null };
    });

    return new StepResponse({ customerNumber, results });
  }
);
