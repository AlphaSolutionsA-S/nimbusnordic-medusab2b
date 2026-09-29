import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { prepareBcOrderStep } from "../steps/prepare-bc-order";
import { recordBcOrderOutcomeStep } from "../steps/record-bc-order-outcome";
import { submitBcOrderStep } from "../steps/submit-bc-order";
import type { PrepareBcOrderInput } from "../steps/prepare-bc-order";

export const SEND_ORDER_TO_BUSINESS_CENTRAL_WORKFLOW = "send-order-to-business-central";

/**
 * Every caller must run the workflow with this transaction id. The duplicate guard in
 * prepareBcOrderStep is check-then-act, so two concurrent runs for the same order could both
 * create a BC order; with a shared id (and `store: true`) the workflow engine refuses the second
 * run while the first is in flight. Finished runs are not retained, so a later retry still runs.
 */
export function getSendOrderToBusinessCentralTransactionId(orderId: string): string {
  return `${SEND_ORDER_TO_BUSINESS_CENTRAL_WORKFLOW}-${orderId}`;
}

/**
 * Reusable Business Central order submission (NIMBUS-148).
 *
 * Invoked by the `order_ingestion.ready_for_business_central` subscriber for the initial automatic
 * send, and later by NIMBUS-158's manual retry. It does not know which one called it: the duplicate
 * guard and the attempt counter live in the steps, so every caller gets the same behaviour.
 */
export const sendOrderToBusinessCentralWorkflow = createWorkflow(
  { name: SEND_ORDER_TO_BUSINESS_CENTRAL_WORKFLOW, store: true },
  function (input: PrepareBcOrderInput) {
    const prepared = prepareBcOrderStep(input);
    const submitted = submitBcOrderStep(prepared);
    const recorded = recordBcOrderOutcomeStep(submitted);

    return new WorkflowResponse(recorded);
  }
);
