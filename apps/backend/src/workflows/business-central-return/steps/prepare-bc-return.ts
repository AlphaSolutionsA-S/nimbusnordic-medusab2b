import { createHash } from "node:crypto";

import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { MedusaError } from "@medusajs/framework/utils";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import type {
  BCReturnLineInput,
  IBusinessCentralModuleService,
} from "../../../modules/business-central/types";

export type PrepareBcReturnInput = {
  customerId: string;
  bcCustomerNumber: string;
  sourceOrderNumber: string;
  lines: BCReturnLineInput[];
};

export type PreparedBcReturn = {
  requestId: string;
  sourceOrderNo: string;
  verifiedLines: BCReturnLineInput[];
};

export const prepareBcReturnStep = createStep(
  "prepare-bc-return",
  async (
    input: PrepareBcReturnInput,
    { container }
  ): Promise<StepResponse<PreparedBcReturn>> => {
    const bcService = container.resolve<IBusinessCentralModuleService>(
      BUSINESS_CENTRAL_MODULE
    );
    const order = await bcService.getOrder({
      customerNumber: input.bcCustomerNumber,
      orderNumber: input.sourceOrderNumber,
    });

    if (!order) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found.");
    }

    // TEMP (NIMBUS-138): BC reason codes cannot be fetched yet; only "NORMAL" is accepted.
    const reasonIds = new Set(["NORMAL"]);
    const sourceLineNumbers = new Set<number>();
    const verifiedLines = input.lines
      .map((inputLine) => {
        if (sourceLineNumbers.has(inputLine.sourceLineNo)) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Each order line can only be returned once per request."
          );
        }
        sourceLineNumbers.add(inputLine.sourceLineNo);

        const matchingLines = order.lines.filter(
          (line) =>
            line.sequence === inputLine.sourceLineNo && line.lineType === "Item"
        );

        if (matchingLines.length === 0) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "One or more selected lines cannot be returned."
          );
        }

        // Only shipped quantities are returnable; an order line and its invoice lines can share a sequence.
        const returnableQuantity = matchingLines.reduce(
          (sum, line) => sum + line.returnableQuantity,
          0
        );

        if (inputLine.quantityToReturn > returnableQuantity) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "The requested return quantity exceeds the available quantity."
          );
        }

        if (!reasonIds.has(inputLine.returnReasonCode)) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "One or more return reasons are invalid."
          );
        }

        return inputLine;
      })
      .sort((left, right) => left.sourceLineNo - right.sourceLineNo);
    const requestIdHash = createHash("sha256")
      .update(
        JSON.stringify({
          customerId: input.customerId,
          sourceOrderNo: order.number,
          lines: verifiedLines,
        })
      )
      .digest("hex")
      .slice(0, 12)
      .toUpperCase();

    return new StepResponse({
      requestId: `RET-${requestIdHash}`,
      sourceOrderNo: order.number,
      verifiedLines,
    });
  }
);
