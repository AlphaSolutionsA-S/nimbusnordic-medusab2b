import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import type {
  BusinessCentralEnvironment,
  IBusinessCentralModuleService,
} from "../../../modules/business-central/types";
import type { ModuleUpdateCompany } from "../../../types";
import { getBusinessCentralEnvironmentForCountry } from "../../../utils/business-central-environment";
import { resolveCurrencyCode } from "../utils/resolve-currency-code";
import type { BusinessCentralAccountCompanyRow } from "./load-business-central-account-company";

export type PrepareCompanyBcSyncInput = {
  company: BusinessCentralAccountCompanyRow | null;
  expectedCompanyId?: string;
};

// Holds no personal data: only when, where and which number was tried.
export type CompanyBcNotFoundUpdate = {
  id: string;
  business_central_not_found_at: Date;
  business_central_not_found_environment: BusinessCentralEnvironment;
  business_central_not_found_customer_number: string;
};

// `not_found` is internal: the workflow writes the record and reports `skipped`.
export type PreparedCompanyBcSync =
  | { status: "skipped"; update: null }
  | { status: "failed"; update: null }
  | { status: "not_found"; update: CompanyBcNotFoundUpdate }
  | { status: "ready"; update: ModuleUpdateCompany };

function joinAddressLines(line1: string, line2: string): string {
  return [line1, line2].filter(Boolean).join(", ");
}

export const prepareCompanyBcSyncStep = createStep(
  "prepare-company-bc-sync",
  async (
    { company, expectedCompanyId }: PrepareCompanyBcSyncInput,
    { container }
  ): Promise<StepResponse<PreparedCompanyBcSync>> => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const companyId = company?.id ?? null;
    const bcCustomerNumber = company?.business_central_customer_number ?? null;
    const environment = getBusinessCentralEnvironmentForCountry(company?.country);

    if (companyId && expectedCompanyId && companyId !== expectedCompanyId) {
      logger.warn(
        `Business Central sync skipped: customer company ${companyId} does not match expected company ${expectedCompanyId}`
      );
      return new StepResponse({ status: "skipped", update: null });
    }

    if (!companyId || !bcCustomerNumber) {
      return new StepResponse({ status: "skipped", update: null });
    }

    const bcService = container.resolve<IBusinessCentralModuleService>(
      BUSINESS_CENTRAL_MODULE
    );

    let bcCustomer;

    try {
      bcCustomer = await bcService.getCustomer(environment, bcCustomerNumber);
    } catch (error: unknown) {
      if (!(error instanceof MedusaError)) {
        throw error;
      }

      logger.error(
        `Business Central company sync failed for company ${companyId} (environment ${environment})`
      );
      return new StepResponse({ status: "failed", update: null });
    }

    if (!bcCustomer) {
      logger.warn(
        `Business Central sync: no matching customer for company ${companyId} (environment ${environment})`
      );
      return new StepResponse({
        status: "not_found",
        update: {
          id: companyId,
          business_central_not_found_at: new Date(),
          business_central_not_found_environment: environment,
          business_central_not_found_customer_number: bcCustomerNumber,
        },
      });
    }

    const update: ModuleUpdateCompany = {
      id: companyId,
      name: bcCustomer.displayName,
      email: bcCustomer.email,
      phone: bcCustomer.phoneNumber,
      address: joinAddressLines(
        bcCustomer.addressLine1,
        bcCustomer.addressLine2
      ),
      city: bcCustomer.city,
      state: bcCustomer.state,
      zip: bcCustomer.postalCode,
      country: bcCustomer.country,
      blocked: bcCustomer.blocked,
      credit_limit: bcCustomer.creditLimit,
      vat_number: bcCustomer.taxRegistrationNumber,
      currency_code: resolveCurrencyCode(environment, bcCustomer.currencyCode),
      business_central_synced_at: new Date(),
      business_central_not_found_at: null,
      business_central_not_found_environment: null,
      business_central_not_found_customer_number: null,
    };

    return new StepResponse({ status: "ready", update });
  }
);
