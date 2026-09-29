import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { ModuleCreateQuoteMessage, ModuleQuoteMessage } from "../../../types";
import { createQuoteMessageStep } from "../steps/create-quote-message";
import { validateQuoteMessageAccessStep } from "../steps/validate-quote-message-access";

/*
  A workflow that creates messages within a quote. Messages are used as a communication trail
  between the merchant and the customer. The message can also hold an item_id for either of the
  actors to have a conversation around or negotiate upon.
*/
export const createQuoteMessageWorkflow = createWorkflow(
  "create-quote-message",
  function (
    input: ModuleCreateQuoteMessage
  ): WorkflowResponse<ModuleQuoteMessage> {
    const authorizedInput = validateQuoteMessageAccessStep(input);
    return new WorkflowResponse(createQuoteMessageStep(authorizedInput));
  }
);
