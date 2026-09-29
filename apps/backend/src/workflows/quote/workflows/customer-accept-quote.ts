import {
  confirmOrderEditRequestWorkflow,
  useQueryGraphStep,
} from "@medusajs/core-flows";
import { OrderStatus } from "@medusajs/framework/utils";
import { createWorkflow } from "@medusajs/framework/workflows-sdk";
import { updateOrderWorkflow } from "../../order/workflows/update-order";
import { validateQuoteAcceptanceStep } from "../steps/validate-quote-acceptance";
import { updateQuotesWorkflow } from "./update-quote";

/*
  A workflow that accepts a quote by a customer. 
  
  Once the customer accepts the quote, any staged changes made on the draft order is then committed.
  The draft order is then converted to an actual order ready for processing.
*/
export const customerAcceptQuoteWorkflow = createWorkflow(
  "customer-accept-quote",
  function (input: { quote_id: string; customer_id: string }) {
    const { data: quotes } = useQueryGraphStep({
      entity: "quote",
      fields: ["id", "draft_order_id", "status"],
      filters: { id: input.quote_id, customer_id: input.customer_id },
      options: { throwIfKeyNotFound: true },
    });
    const quote = quotes[0];

    validateQuoteAcceptanceStep({ quote });

    updateQuotesWorkflow.runAsStep({
      input: [{ id: quote.id, status: "accepted" }],
    });

    confirmOrderEditRequestWorkflow.runAsStep({
      input: {
        order_id: quote.draft_order_id,
        confirmed_by: input.customer_id,
      },
    });

    updateOrderWorkflow.runAsStep({
      input: {
        id: quote.draft_order_id,
        is_draft_order: false,
        status: OrderStatus.PENDING,
      },
    });
  }
);
