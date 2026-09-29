import { useQueryGraphStep } from "@medusajs/core-flows";
import { createWorkflow } from "@medusajs/framework/workflows-sdk";
import { updateQuotesWorkflow } from "./update-quote";

/*
  A workflow that rejects a quote by a customer. 
  
  Once the customer rejects the quote, the decision then turns to the merchant to perform
  any further adjustments, or let it remain in a rejected state.
*/
export const customerRejectQuoteWorkflow = createWorkflow(
  "customer-reject-quote",
  function (input: { quote_id: string; customer_id: string }) {
    const { data: quotes } = useQueryGraphStep({
      entity: "quote",
      fields: ["id"],
      filters: { id: input.quote_id, customer_id: input.customer_id },
      options: { throwIfKeyNotFound: true },
    });

    updateQuotesWorkflow.runAsStep({
      input: [
        {
          id: quotes[0].id,
          status: "customer_rejected",
        },
      ],
    });
  }
);
