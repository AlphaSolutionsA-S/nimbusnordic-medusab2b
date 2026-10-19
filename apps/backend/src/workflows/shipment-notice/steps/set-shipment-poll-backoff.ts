import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ORDER_INGESTION_MODULE } from "../../../modules/order-ingestion";
import type OrderIngestionModuleService from "../../../modules/order-ingestion/service";
import { SHIPMENT_MIN_BACKOFF_SECONDS } from "../utils/discovery-window";

export type SetShipmentPollBackoffInput = {
  throttled: boolean;
  retry_after_seconds: number | null;
};

/**
 * After BC throttled a scan, polling pauses for BC's Retry-After, but never less than a minute
 * (NIMBUS-130). Does nothing when no scan was throttled.
 */
export const setShipmentPollBackoffStep = createStep(
  "set-shipment-poll-backoff",
  async (
    input: SetShipmentPollBackoffInput,
    { container }
  ): Promise<StepResponse<{ backoff_until: string | null }>> => {
    if (!input.throttled) {
      return new StepResponse({ backoff_until: null });
    }

    const seconds = Math.max(input.retry_after_seconds ?? 0, SHIPMENT_MIN_BACKOFF_SECONDS);
    const until = new Date(Date.now() + seconds * 1000);
    await container
      .resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE)
      .setShipmentPollBackoff(until);

    return new StepResponse({ backoff_until: until.toISOString() });
  }
);
