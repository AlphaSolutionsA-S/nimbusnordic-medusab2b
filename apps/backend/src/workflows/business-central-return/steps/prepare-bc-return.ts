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
  sourceSalesOrderId: string;
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
      orderId: input.sourceSalesOrderId,
    });

    if (!order) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found.");
    }

    const returnReasons = await bcService.listReturnReasons();
    const reasonIds = new Set(returnReasons.map((reason) => reason.id));
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

        const orderLine = order.lines.find(
          (line) =>
            line.sequence === inputLine.sourceLineNo && line.lineType === "Item"
        );

        if (!orderLine) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "One or more selected lines cannot be returned."
          );
        }

        if (inputLine.quantityToReturn > orderLine.quantity) {
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
