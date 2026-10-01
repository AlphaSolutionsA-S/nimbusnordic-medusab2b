import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  emitEventStep,
  getOrderDetailWorkflow,
} from "@medusajs/medusa/core-flows";
import { reserveBcSubmissionStep } from "../steps/reserve-bc-submission";
import { ADMIN_BC_SUBMISSION_REQUESTED_EVENT } from "../utils/submission-reservation";

export const requestBcSubmissionWorkflow = createWorkflow(
  "request-bc-submission",
  function (input: { order_id: string; force_resend: boolean }) {
    const order = getOrderDetailWorkflow.runAsStep({
      input: { order_id: input.order_id, fields: ["id"] },
    });
    const reserved = reserveBcSubmissionStep({
      order_id: order.id,
      force_resend: input.force_resend,
    });
    emitEventStep({
      eventName: ADMIN_BC_SUBMISSION_REQUESTED_EVENT,
      data: reserved,
    });
    return new WorkflowResponse({ accepted: true });
  }
);
