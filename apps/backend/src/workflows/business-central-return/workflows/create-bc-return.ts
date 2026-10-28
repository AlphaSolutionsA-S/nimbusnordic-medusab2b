import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { prepareBcReturnStep } from "../steps/prepare-bc-return";
import { submitBcReturnStep } from "../steps/submit-bc-return";
import type { PrepareBcReturnInput } from "../steps/prepare-bc-return";

export { BC_RETURN_VALIDATION_ERROR } from "../steps/prepare-bc-return";

export const createBcReturnWorkflow = createWorkflow(
  "create-bc-return",
  function (input: PrepareBcReturnInput) {
    const prepared = prepareBcReturnStep(input);
    const submitInput = transform({ input, prepared }, ({ input, prepared }) => ({
      environment: input.environment,
      requestId: prepared.requestId,
      sourceOrderNo: prepared.sourceOrderNo,
      verifiedLines: prepared.verifiedLines,
    }));
    const result = submitBcReturnStep(submitInput);

    return new WorkflowResponse(result);
  }
);
