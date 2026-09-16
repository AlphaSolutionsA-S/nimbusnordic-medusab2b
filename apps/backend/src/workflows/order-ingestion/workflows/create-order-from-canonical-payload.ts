import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { matchCompanyAndCheckDuplicateStep } from "../steps/match-company-and-check-duplicate";
import { createOrderAndReferenceStep } from "../steps/create-order-and-reference";
import type { CanonicalOrder } from "../../../modules/order-ingestion/canonical-order-schema";

export type CreateOrderFromCanonicalPayloadInput = {
  customer_number: string;
  canonicalOrder: CanonicalOrder;
};

export const createOrderFromCanonicalPayloadWorkflow = createWorkflow(
  "create-order-from-canonical-payload",
  function (input: CreateOrderFromCanonicalPayloadInput) {
    const matched = matchCompanyAndCheckDuplicateStep(input);

    const createOrderInput = transform({ matched, input }, (data) => ({
      companyId: data.matched.companyId,
      canonicalOrder: data.input.canonicalOrder,
    }));

    const order = createOrderAndReferenceStep(createOrderInput);

    return new WorkflowResponse(order);
  }
);
