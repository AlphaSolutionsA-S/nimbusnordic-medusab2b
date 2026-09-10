import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import type {
  BCReturnLineInput,
  BCReturnOrder,
  IBusinessCentralModuleService,
} from "../../../modules/business-central/types";

export type SubmitBcReturnInput = {
  requestId: string;
  sourceOrderNo: string;
  verifiedLines: BCReturnLineInput[];
};

export const submitBcReturnStep = createStep(
  "submit-bc-return",
  async (
    input: SubmitBcReturnInput,
    { container }
  ): Promise<StepResponse<BCReturnOrder>> => {
    const bcService = container.resolve<IBusinessCentralModuleService>(
      BUSINESS_CENTRAL_MODULE
    );
    const returnOrder = await bcService.createReturnFromSalesOrder({
      requestId: input.requestId,
      sourceOrderNo: input.sourceOrderNo,
      lines: input.verifiedLines,
    });

    return new StepResponse(returnOrder);
  }
);
