import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { MedusaError } from "@medusajs/framework/utils";
import { ORDER_INGESTION_MODULE } from "../../../modules/order-ingestion";
import OrderIngestionModuleService from "../../../modules/order-ingestion/service";

export type CheckDuplicateExternalOrderInput = {
  company_id: string;
  external_order_number: string;
};

/*
  A read-only step that guards against the same external order number being submitted twice by
  the same company. It never mutates anything, so it has no compensation function. The message
  echoes only the caller's own external order number.
*/
export const checkDuplicateExternalOrderStep = createStep(
  "check-duplicate-external-order",
  async (input: CheckDuplicateExternalOrderInput, { container }) => {
    const orderIngestionService =
      container.resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);

    const duplicates = await orderIngestionService.listOrderExternalReferences({
      external_order_number: input.external_order_number,
      company_id: input.company_id,
    });

    if (duplicates.length > 0) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        `Order '${input.external_order_number}' was already accepted for this company`
      );
    }

    return new StepResponse(undefined);
  }
);
