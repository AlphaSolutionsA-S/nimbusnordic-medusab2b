import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";
import { createRemoteLinkStep } from "@medusajs/medusa/core-flows";
import { COMPANY_MODULE } from "../../../modules/company";
import { matchCompanyAndCheckDuplicateStep } from "../steps/match-company-and-check-duplicate";
import { createIngestedOrderStep } from "../steps/create-ingested-order";
import { createOrderExternalReferenceStep } from "../steps/create-order-external-reference";
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

    const order = createIngestedOrderStep(createOrderInput);

    // Replicates src/workflows/hooks/order-created.ts's link directly — that hook only fires for
    // createOrderWorkflow, which this workflow deliberately does not use.
    const linkData = transform({ order, matched }, (data) => [
      {
        [Modules.ORDER]: {
          order_id: data.order.id,
        },
        [COMPANY_MODULE]: {
          company_id: data.matched.companyId,
        },
      },
    ]);

    createRemoteLinkStep(linkData);

    const referenceInput = transform({ order, matched, input }, (data) => ({
      external_order_number: data.input.canonicalOrder.externalOrderNumber,
      company_id: data.matched.companyId,
      order_id: data.order.id,
    }));

    createOrderExternalReferenceStep(referenceInput);

    return new WorkflowResponse(order);
  }
);
