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

export type PrepareCompanyBcSyncInput =
  | { customerId: string; expectedCompanyId?: string; companyId?: never }
  | { companyId: string; customerId?: never; expectedCompanyId?: never };

type CompanyBcKey = {
  companyId: string | null;
  bcCustomerNumber: string | null;
  environment: BusinessCentralEnvironment;
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

const COMPANY_BC_KEY_FIELDS = [
  "id",
  "business_central_customer_number",
  "country",
] as const;

function toCompanyBcKey(
  company:
    | {
        id?: string;
        business_central_customer_number?: string | null;
        country?: string | null;
      }
    | null
    | undefined
): CompanyBcKey {
  return {
    companyId: company?.id ?? null,
    bcCustomerNumber: company?.business_central_customer_number ?? null,
    environment: getBusinessCentralEnvironmentForCountry(company?.country),
  };
}

function joinAddressLines(line1: string, line2: string): string {
  return [line1, line2].filter(Boolean).join(", ");
}

export const prepareCompanyBcSyncStep = createStep(
  "prepare-company-bc-sync",
  async (
    input: PrepareCompanyBcSyncInput,
    { container }
  ): Promise<StepResponse<PreparedCompanyBcSync>> => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    let companyId: string | null;
    let bcCustomerNumber: string | null;
    let environment: BusinessCentralEnvironment;

    if (input.companyId !== undefined) {
      const {
        data: [company],
      } = await query.graph({
        entity: "company",
        fields: [...COMPANY_BC_KEY_FIELDS],
        filters: { id: input.companyId },
      });

      if (!company) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Company with id ${input.companyId} was not found`
        );
      }

      ({ companyId, bcCustomerNumber, environment } = toCompanyBcKey(company));
    } else {
      const {
        data: [customer],
      } = await query.graph({
        entity: "customer",
        fields: COMPANY_BC_KEY_FIELDS.map(
          (field) => `employee.company.${field}`
        ),
        filters: { id: input.customerId },
      });

      ({ companyId, bcCustomerNumber, environment } = toCompanyBcKey(
        customer?.employee?.company
      ));

      if (
        companyId &&
        input.expectedCompanyId &&
        companyId !== input.expectedCompanyId
      ) {
        logger.warn(
          `Business Central sync skipped: customer company ${companyId} does not match expected company ${input.expectedCompanyId}`
        );
        return new StepResponse({ status: "skipped", update: null });
      }
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
