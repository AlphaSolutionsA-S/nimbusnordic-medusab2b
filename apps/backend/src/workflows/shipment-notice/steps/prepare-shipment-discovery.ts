import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ORDER_INGESTION_MODULE } from "../../../modules/order-ingestion";
import type OrderIngestionModuleService from "../../../modules/order-ingestion/service";
import { shipmentScanBounds } from "../utils/discovery-window";

export type ShipmentScanRange = {
  /** The scan cursor: the end of the last window read completely. */
  after: string;
  bound: string;
};

export type ShipmentDiscoveryPlan = {
  now: string;
  /** True when this run created the poll state; such a run reads nothing from BC. */
  initialized: boolean;
  go_live_at: string;
  lead: ShipmentScanRange;
  trail: ShipmentScanRange;
};

/**
 * Reads the poll state, or creates it on the first run (go-live and both cursors = now), and fixes
 * the run's clock and the two scan bounds. Dates are ISO strings so they survive the workflow's
 * serialisation of step results.
 */
export const prepareShipmentDiscoveryStep = createStep(
  "prepare-shipment-discovery",
  async (_input: void, { container }): Promise<StepResponse<ShipmentDiscoveryPlan>> => {
    const orderIngestion =
      container.resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);
    const now = new Date();
    const { state, created } = await orderIngestion.initializeShipmentPollState(now);
    const bounds = shipmentScanBounds(now);

    return new StepResponse({
      now: now.toISOString(),
      initialized: created,
      go_live_at: state.go_live_at.toISOString(),
      lead: { after: state.lead_cursor.toISOString(), bound: bounds.lead.toISOString() },
      trail: { after: state.trail_cursor.toISOString(), bound: bounds.trail.toISOString() },
    });
  }
);
