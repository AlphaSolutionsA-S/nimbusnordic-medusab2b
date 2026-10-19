import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { prepareShipmentPollStep } from "../steps/prepare-shipment-poll";
import type { ShipmentPollSummary } from "../utils/shipment-poll";
import { checkShipmentsWorkflow } from "./check-shipments";
import { discoverShipmentsWorkflow } from "./discover-shipments";

export const POLL_SHIPMENT_NOTICES_WORKFLOW = "poll-shipment-notices";

/**
 * One shipment notice poll run (NIMBUS-130): discovery, then the due checks, both bounded by one
 * run deadline. A run inside a BC throttling back-off makes no BC call. When discovery stops
 * early (throttled, or out of time) the checks are left for the next run: a throttled BC must not
 * be called again, and past the deadline the checks could start no BC request anyway.
 */
export const pollShipmentNoticesWorkflow = createWorkflow(
  POLL_SHIPMENT_NOTICES_WORKFLOW,
  function () {
    const start = prepareShipmentPollStep();
    const deadline = transform({ start }, ({ start }) => ({ deadline: new Date(start.deadline) }));

    const discovered = when("discover-unless-backed-off", { start }, ({ start }) => {
      return !start.backed_off;
    }).then(() => discoverShipmentsWorkflow.runAsStep({ input: deadline }));

    const checked = when(
      "check-after-complete-discovery",
      { start, discovered },
      ({ start, discovered }) => !start.backed_off && discovered?.complete === true
    ).then(() => checkShipmentsWorkflow.runAsStep({ input: deadline }));

    const summary = transform(
      { start, discovered, checked },
      ({ start, discovered, checked }) => {
        const result: ShipmentPollSummary = {
          backed_off: start.backed_off,
          headers: discovered?.headers ?? 0,
          matched: discovered?.matched ?? 0,
          lead_lag_ms: discovered?.lead_lag_ms ?? null,
          trail_lag_ms: discovered?.trail_lag_ms ?? null,
          checked: checked?.checked ?? 0,
          recorded: checked?.recorded ?? 0,
          unchanged: checked?.unchanged ?? 0,
          conflicts: checked?.conflicts ?? 0,
          errors: checked?.errors ?? 0,
          backlog_due: checked?.backlog_due ?? null,
          oldest_due_age_ms: checked?.oldest_due_age_ms ?? null,
        };
        return result;
      }
    );

    return new WorkflowResponse(summary);
  }
);
