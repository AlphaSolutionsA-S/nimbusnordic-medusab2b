import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa";
import { enrichOrderWorkflow } from "../workflows/order-ingestion/workflows/enrich-order";
import { ORDER_INGESTION_CREATED_EVENT } from "../workflows/order-ingestion/workflows/emit-order-ingestion-created-event";

type OrderIngestionCreatedEventData = {
  order_id: string;
};

export default async function orderIngestionCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<OrderIngestionCreatedEventData>) {
  await enrichOrderWorkflow(container).run({
    input: { order_id: data.order_id },
  });
}

export const config: SubscriberConfig = {
  event: ORDER_INGESTION_CREATED_EVENT,
};
