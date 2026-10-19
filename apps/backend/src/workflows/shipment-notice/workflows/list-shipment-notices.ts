import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  resolveCompanyByCustomerNumberStep,
} from "../../order-ingestion/steps/resolve-company-by-customer-number";
import { listCompanyShipmentNoticesStep } from "../steps/list-company-shipment-notices";

export type ListShipmentNoticesWorkflowInput = {
  customer_number: string;
  limit: number;
  after: string | null;
  since: string | null;
};

/**
 * A customer's shipment notices for the order API (NIMBUS-130): the company comes only from the
 * customer number, so a caller never reads another company's notices. A pure read.
 */
export const listShipmentNoticesWorkflow = createWorkflow(
  "list-shipment-notices",
  function (input: ListShipmentNoticesWorkflowInput) {
    const resolved = resolveCompanyByCustomerNumberStep({
      customer_number: input.customer_number,
    });

    const request = transform({ input, resolved }, ({ input, resolved }) => ({
      company_id: resolved.company_id,
      limit: input.limit,
      after: input.after,
      since: input.since,
    }));

    return new WorkflowResponse(listCompanyShipmentNoticesStep(request));
  }
);
