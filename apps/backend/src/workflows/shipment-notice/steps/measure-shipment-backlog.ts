import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ORDER_INGESTION_MODULE } from "../../../modules/order-ingestion";
import type OrderIngestionModuleService from "../../../modules/order-ingestion/service";

export type ShipmentBacklog = {
  /** Open tracking rows still due after the run. */
  backlog_due: number;
  /** How long the oldest of them has been due; 0 when none is. */
  oldest_due_age_ms: number;
};

/** The due backlog left after a check run, for the poll job's stalled-progress warning. */
export const measureShipmentBacklogStep = createStep(
  "measure-shipment-backlog",
  async (_input: void, { container }): Promise<StepResponse<ShipmentBacklog>> => {
    const orderIngestion =
      container.resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);
    const now = new Date();
    const [oldest, count] = await orderIngestion.listAndCountShipmentTrackings(
      { state: "open", next_check_at: { $lte: now } },
      { select: ["next_check_at"], order: { next_check_at: "ASC" }, take: 1 }
    );

    return new StepResponse({
      backlog_due: count,
      oldest_due_age_ms: oldest.length
        ? Math.max(0, now.getTime() - new Date(oldest[0].next_check_at).getTime())
        : 0,
    });
  }
);
