import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { prepareBcReturnStep } from "../steps/prepare-bc-return";
import { submitBcReturnStep } from "../steps/submit-bc-return";
import type { PrepareBcReturnInput } from "../steps/prepare-bc-return";

export const createBcReturnWorkflow = createWorkflow(
  "create-bc-return",
  function (input: PrepareBcReturnInput) {
    const prepared = prepareBcReturnStep(input);
    const submitInput = transform({ prepared }, ({ prepared }) => ({
      requestId: prepared.requestId,
      sourceOrderNo: prepared.sourceOrderNo,
      verifiedLines: prepared.verifiedLines,
    }));
    const result = submitBcReturnStep(submitInput);

    return new WorkflowResponse(result);
  }
);
