import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ORDER_INGESTION_MODULE } from "../../../modules/order-ingestion";
import type OrderIngestionModuleService from "../../../modules/order-ingestion/service";
import { isShipmentPollBackedOff, shipmentPollDeadline } from "../utils/shipment-poll";

export type ShipmentPollStart = {
  /** A BC throttling back-off is still in force: the run makes no BC call. */
  backed_off: boolean;
  /** ISO string, so it survives the workflow's serialisation of step results. */
  deadline: string;
};

/** Starts a poll run: fixes its deadline and reads whether the BC back-off is in force. */
export const prepareShipmentPollStep = createStep(
  "prepare-shipment-poll",
  async (_input: void, { container }): Promise<StepResponse<ShipmentPollStart>> => {
    const orderIngestion =
      container.resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);
    const now = new Date();
    const state = await orderIngestion.retrieveShipmentPollState();

    return new StepResponse({
      backed_off: isShipmentPollBackedOff(state?.bc_backoff_until ?? null, now),
      deadline: shipmentPollDeadline(now).toISOString(),
    });
  }
);
