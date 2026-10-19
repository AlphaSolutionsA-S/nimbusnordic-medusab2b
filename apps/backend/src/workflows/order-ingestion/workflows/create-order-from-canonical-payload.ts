import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";
import { createRemoteLinkStep } from "@medusajs/medusa/core-flows";
import { COMPANY_MODULE } from "../../../modules/company";
import { resolveCompanyByCustomerNumberStep } from "../steps/resolve-company-by-customer-number";
import { checkDuplicateExternalOrderStep } from "../steps/check-duplicate-external-order";
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
    const resolved = resolveCompanyByCustomerNumberStep({
      customer_number: input.customer_number,
    });

    const duplicateCheckInput = transform({ resolved, input }, (data) => ({
      company_id: data.resolved.company_id,
      external_order_number: data.input.canonicalOrder.externalOrderNumber,
    }));

    checkDuplicateExternalOrderStep(duplicateCheckInput);

    const createOrderInput = transform({ resolved, input }, (data) => ({
      companyId: data.resolved.company_id,
      canonicalOrder: data.input.canonicalOrder,
    }));

    const order = createIngestedOrderStep(createOrderInput);

    // Replicates src/workflows/hooks/order-created.ts's link directly — that hook only fires for
    // createOrderWorkflow, which this workflow deliberately does not use.
    const linkData = transform({ order, resolved }, (data) => [
      {
        [Modules.ORDER]: {
          order_id: data.order.id,
        },
        [COMPANY_MODULE]: {
          company_id: data.resolved.company_id,
        },
      },
    ]);

    createRemoteLinkStep(linkData);

    const referenceInput = transform({ order, resolved, input }, (data) => ({
      external_order_number: data.input.canonicalOrder.externalOrderNumber,
      company_id: data.resolved.company_id,
      order_id: data.order.id,
    }));

    createOrderExternalReferenceStep(referenceInput);

    return new WorkflowResponse(order);
  }
);
