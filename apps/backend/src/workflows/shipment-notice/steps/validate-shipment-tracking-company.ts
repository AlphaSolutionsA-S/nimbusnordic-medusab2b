import { createStep } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { ORDER_INGESTION_MODULE } from "../../../modules/order-ingestion";
import type OrderIngestionModuleService from "../../../modules/order-ingestion/service";
import {
  isCompanyEnabledForOrderApi,
  type OrderApiAccessCompany,
} from "../../../utils/order-api-access";

const COMPANY_NOT_ENABLED_FOR_ORDER_API_MESSAGE =
  "The company is not enabled for the order API";

// Local generated types can lag the company model, so the row is a structural subset.
type CompanySettingRow = { id: string } & OrderApiAccessCompany;

/**
 * Refuses an Admin retry of a shipment whose company is switched off or gone (NIMBUS-217), before
 * the row is touched. A missing tracking row is left to the reopen step, which answers 404.
 */
export const validateShipmentTrackingCompanyStep = createStep(
  "validate-shipment-tracking-company",
  async (input: { id: string }, { container }): Promise<void> => {
    const orderIngestion =
      container.resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);
    const [tracking] = await orderIngestion.listShipmentTrackings(
      { id: input.id },
      { select: ["id", "company_id"] }
    );
    if (!tracking) {
      return;
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: companies } = await query.graph({
      entity: "companies",
      fields: ["id", "order_api_enabled"],
      filters: { id: tracking.company_id },
    });
    const company: CompanySettingRow | undefined = companies[0];
    if (!isCompanyEnabledForOrderApi(company)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        COMPANY_NOT_ENABLED_FOR_ORDER_API_MESSAGE
      );
    }
  }
);
