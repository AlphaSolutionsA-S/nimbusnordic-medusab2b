import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ORDER_INGESTION_MODULE } from "../../../modules/order-ingestion";
import type OrderIngestionModuleService from "../../../modules/order-ingestion/service";
import type {
  ShipmentNoticeEnvelope,
} from "../../../modules/order-ingestion/shipment-notice-contract";
import {
  companyShipmentNoticeQuery,
  shipmentNoticePage,
  type ShipmentNoticeReadRequest,
} from "../utils/shipment-notice-page";

/**
 * Reads one page of a company's shipment notices in the wire contract. A pure read, so no
 * compensation; it maps to the envelope here so the step result holds no `Date` objects.
 */
export const listCompanyShipmentNoticesStep = createStep(
  "list-company-shipment-notices",
  async (
    input: ShipmentNoticeReadRequest,
    { container }
  ): Promise<StepResponse<ShipmentNoticeEnvelope>> => {
    const orderIngestion =
      container.resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);
    const rows = await orderIngestion.listCompanyShipmentNotices(
      companyShipmentNoticeQuery(input)
    );
    return new StepResponse(shipmentNoticePage(rows, { limit: input.limit, after: input.after }));
  }
);
