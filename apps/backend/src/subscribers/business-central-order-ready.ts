import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa";
import { SkipExecutionError } from "@medusajs/framework/orchestration";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { READY_FOR_BUSINESS_CENTRAL_EVENT } from "../workflows/order-ingestion/workflows/enrich-order";
import {
  getSendOrderToBusinessCentralTransactionId,
  sendOrderToBusinessCentralWorkflow,
} from "../workflows/business-central-order/workflows/send-order-to-business-central";

type ReadyForBusinessCentralEventData = {
  order_id: string;
};

export default async function businessCentralOrderReadyHandler({
  event: { data },
  container,
}: SubscriberArgs<ReadyForBusinessCentralEventData>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    const { result } = await sendOrderToBusinessCentralWorkflow(container).run({
      input: { order_id: data.order_id },
      context: {
        transactionId: getSendOrderToBusinessCentralTransactionId(data.order_id),
      },
    });

    logger.info(
      `Business Central submission for order ${data.order_id} finished with status ${result.status}`
    );
  } catch (error) {
    // Another submission for this order is already in flight; it records the outcome.
    if (error instanceof Error && SkipExecutionError.isSkipExecutionError(error)) {
      logger.info(
        `Business Central submission for order ${data.order_id} skipped: another submission is already running`
      );
      return;
    }

    // Business failures are already recorded on the order's integration state by the workflow.
    // Reaching here means something exceptional happened. Log and stop; never throw from a
    // subscriber.
    logger.error(
      `Business Central submission for order ${data.order_id} could not run: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }
}

export const config: SubscriberConfig = {
  event: READY_FOR_BUSINESS_CENTRAL_EVENT,
};
