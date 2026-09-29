import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { MedusaError } from "@medusajs/framework/utils";
import { ORDER_INGESTION_MODULE } from "../../../modules/order-ingestion";
import OrderIngestionModuleService from "../../../modules/order-ingestion/service";

export type CreateOrderExternalReferenceInput = {
  external_order_number: string;
  company_id: string;
  order_id: string;
};

/*
  Records the per-company external order number. The (company_id, external_order_number) unique
  index makes this insert the atomic duplicate guard: a concurrent duplicate that slipped past
  matchCompanyAndCheckDuplicateStep fails here, and the workflow rolls back the order and link.
*/
export const createOrderExternalReferenceStep = createStep(
  "create-order-external-reference",
  async (
    input: CreateOrderExternalReferenceInput,
    { container }
  ): Promise<StepResponse<{ id: string }, string>> => {
    const orderIngestionService =
      container.resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);

    let reference: { id: string };

    try {
      reference = await orderIngestionService.createOrderExternalReferences(input);
    } catch (error) {
      // A concurrent winner's reference means this insert lost the race on the unique index.
      // Report it like matchCompanyAndCheckDuplicateStep does, instead of the mapped DB error
      // (which is a 400 exposing the internal company id).
      const existing = await orderIngestionService.listOrderExternalReferences({
        external_order_number: input.external_order_number,
        company_id: input.company_id,
      });

      if (existing.length > 0) {
        throw new MedusaError(
          MedusaError.Types.DUPLICATE_ERROR,
          `Order '${input.external_order_number}' was already accepted for this company`
        );
      }

      throw error;
    }

    return new StepResponse({ id: reference.id }, reference.id);
  },
  async (referenceId, { container }) => {
    if (!referenceId) {
      return;
    }

    const orderIngestionService =
      container.resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);

    await orderIngestionService.deleteOrderExternalReferences(referenceId);
  }
);
