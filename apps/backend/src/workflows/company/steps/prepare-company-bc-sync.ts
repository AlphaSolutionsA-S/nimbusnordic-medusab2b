import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import type { IBusinessCentralModuleService } from "../../../modules/business-central/types";
import type { ModuleUpdateCompany } from "../../../types";

export type PrepareCompanyBcSyncInput = {
  customerId: string;
};

export type PreparedCompanyBcSync =
  | { status: "skipped"; update: null }
  | { status: "failed"; update: null }
  | { status: "ready"; update: ModuleUpdateCompany };

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

    const {
      data: [customer],
    } = await query.graph({
      entity: "customer",
      fields: [
        "employee.company.id",
        "employee.company.business_central_customer_number",
      ],
      filters: { id: input.customerId },
    });

    const company = customer?.employee?.company as
      | {
          id?: string;
          business_central_customer_number?: string | null;
        }
      | undefined;
    const companyId = company?.id ?? null;
    const bcCustomerNumber =
      company?.business_central_customer_number ?? null;

    if (!companyId || !bcCustomerNumber) {
      return new StepResponse({ status: "skipped", update: null });
    }

    const bcService = container.resolve<IBusinessCentralModuleService>(
      BUSINESS_CENTRAL_MODULE
    );

    let bcCustomer;

    try {
      bcCustomer = await bcService.getCustomer(bcCustomerNumber);
    } catch (error: unknown) {
      if (!(error instanceof MedusaError)) {
        throw error;
      }

      logger.error(
        `Business Central company sync failed for company ${companyId}`
      );
      return new StepResponse({ status: "failed", update: null });
    }

    if (!bcCustomer) {
      logger.warn(
        `Business Central sync skipped: no matching customer for company ${companyId}`
      );
      return new StepResponse({ status: "skipped", update: null });
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
      currency_code: bcCustomer.currencyCode,
      business_central_synced_at: new Date(),
    };

    return new StepResponse({ status: "ready", update });
  }
);
