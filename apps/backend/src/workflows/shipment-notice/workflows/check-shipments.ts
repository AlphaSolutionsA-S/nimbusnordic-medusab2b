import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { checkShipmentsStep } from "../steps/check-shipments";
import { measureShipmentBacklogStep } from "../steps/measure-shipment-backlog";
import { prepareShipmentChecksStep } from "../steps/prepare-shipment-checks";
import { setShipmentPollBackoffStep } from "../steps/set-shipment-poll-backoff";

export const CHECK_SHIPMENTS_WORKFLOW = "check-shipments";

export type CheckShipmentsWorkflowInput = {
  /** No BC request starts after it; rows not read by then stay due. */
  deadline: Date;
};

export type CheckShipmentsWorkflowResult = {
  checked: number;
  recorded: number;
  unchanged: number;
  conflicts: number;
  errors: number;
  backlog_due: number;
  oldest_due_age_ms: number;
  /** `completed_with_errors` when any shipment could not be checked. */
  status: "completed" | "completed_with_errors";
};

/**
 * Checks the due tracked shipments against BC (NIMBUS-130): at most 200 per run, oldest due first,
 * each decided and stored against the revision read before the BC read, then rescheduled or
 * closed. A throttled BC read sets the poll back-off and leaves the unread rows due.
 */
export const checkShipmentsWorkflow = createWorkflow(
  CHECK_SHIPMENTS_WORKFLOW,
  function (input: CheckShipmentsWorkflowInput) {
    const { checks } = prepareShipmentChecksStep();

    const checkInput = transform({ input, checks }, ({ input, checks }) => ({
      checks,
      deadline: input.deadline,
    }));
    const checked = checkShipmentsStep(checkInput);

    const throttle = transform({ checked }, ({ checked }) => ({
      throttled: checked.throttled,
      retry_after_seconds: checked.retry_after_seconds,
    }));
    setShipmentPollBackoffStep(throttle).config({ name: "set-shipment-check-backoff" });

    const backlog = measureShipmentBacklogStep();

    const result = transform({ checked, backlog }, ({ checked, backlog }) => {
      const summary: CheckShipmentsWorkflowResult = {
        checked: checked.checked,
        recorded: checked.recorded,
        unchanged: checked.unchanged,
        conflicts: checked.conflicts,
        errors: checked.errors,
        backlog_due: backlog.backlog_due,
        oldest_due_age_ms: backlog.oldest_due_age_ms,
        status: checked.errors > 0 ? "completed_with_errors" : "completed",
      };
      return summary;
    });

    return new WorkflowResponse(result);
  }
);
