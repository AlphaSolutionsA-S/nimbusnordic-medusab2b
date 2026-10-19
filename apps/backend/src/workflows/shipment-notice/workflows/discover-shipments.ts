import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { prepareShipmentDiscoveryStep } from "../steps/prepare-shipment-discovery";
import { scanShipmentWindowsStep } from "../steps/scan-shipment-windows";
import { setShipmentPollBackoffStep } from "../steps/set-shipment-poll-backoff";

export const DISCOVER_SHIPMENTS_WORKFLOW = "discover-shipments";

export type DiscoverShipmentsInput = {
  /** No BC request starts after it, and a window it interrupts is not advanced. */
  deadline: Date;
};

export type DiscoverShipmentsResult = {
  headers: number;
  matched: number;
  tracked: number;
  lead_lag_ms: number;
  trail_lag_ms: number;
  /** Both scans reached their bounds. */
  complete: boolean;
};

/**
 * Finds posted BC shipments of API orders and tracks them for the check run (NIMBUS-130). The
 * lead scan follows the clock 15 minutes behind; the trail scan re-reads 30 minutes further back
 * for headers BC made visible late. A throttled scan sets the poll back-off and ends the run.
 */
export const discoverShipmentsWorkflow = createWorkflow(
  DISCOVER_SHIPMENTS_WORKFLOW,
  function (input: DiscoverShipmentsInput) {
    const plan = prepareShipmentDiscoveryStep();

    const leadInput = transform({ input, plan }, ({ input, plan }) => ({
      cursor: "lead" as const,
      after: plan.lead.after,
      bound: plan.lead.bound,
      go_live_at: plan.go_live_at,
      deadline: input.deadline,
      skip: plan.initialized,
    }));
    const lead = scanShipmentWindowsStep(leadInput).config({ name: "scan-lead-shipment-windows" });

    const trailInput = transform({ input, plan, lead }, ({ input, plan, lead }) => ({
      cursor: "trail" as const,
      after: plan.trail.after,
      bound: plan.trail.bound,
      go_live_at: plan.go_live_at,
      deadline: input.deadline,
      skip: plan.initialized || lead.throttled,
    }));
    const trail = scanShipmentWindowsStep(trailInput).config({
      name: "scan-trail-shipment-windows",
    });

    const throttle = transform({ lead, trail }, ({ lead, trail }) => {
      const throttled = lead.throttled ? lead : trail;
      return { throttled: throttled.throttled, retry_after_seconds: throttled.retry_after_seconds };
    });
    setShipmentPollBackoffStep(throttle);

    const result = transform({ plan, lead, trail }, ({ plan, lead, trail }) => {
      const now = new Date(plan.now).getTime();
      const discovered: DiscoverShipmentsResult = {
        headers: lead.headers + trail.headers,
        matched: lead.matched + trail.matched,
        tracked: lead.tracked + trail.tracked,
        lead_lag_ms: now - new Date(lead.cursor_at).getTime(),
        trail_lag_ms: now - new Date(trail.cursor_at).getTime(),
        complete: plan.initialized || (lead.complete && trail.complete),
      };
      return discovered;
    });

    return new WorkflowResponse(result);
  }
);
