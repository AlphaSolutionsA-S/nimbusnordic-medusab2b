import type { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createOrderFromCanonicalPayloadWorkflow } from "../../../workflows/order-ingestion/workflows/create-order-from-canonical-payload";
import { emitOrderIngestionCreatedEventWorkflow } from "../../../workflows/order-ingestion/workflows/emit-order-ingestion-created-event";
import type { CanonicalOrder } from "../../../modules/order-ingestion/canonical-order-schema";
import type { OrderApiOrdersQueryType } from "./validators";

export async function POST(
  req: MedusaRequest<CanonicalOrder>,
  res: MedusaResponse
): Promise<void> {
  // Cast justified: this repo has no existing example of a second MedusaRequest query generic
  // wired through validateAndTransformQuery's runtime-set req.validatedQuery — the middleware
  // guarantees this shape at runtime (see validators.ts), this cast just gives it back to TS.
  const { customerNumber } =
    req.validatedQuery as unknown as OrderApiOrdersQueryType;
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  // Synchronous and awaited on purpose: this workflow rejects with a correctly-typed error
  // (404 unknown customer, 422 duplicate) if it can't create the order — do not wrap this in
  // try/catch. If it succeeds, `order` is a real, persisted Medusa Order.
  const { result: order } = await createOrderFromCanonicalPayloadWorkflow(
    req.scope
  ).run({
    input: {
      customer_number: customerNumber,
      canonicalOrder: req.validatedBody,
    },
  });

  // Deliberate fire-and-forget: only the event *emission* is unawaited, not the order creation
  // itself (which already completed above). This must never block the response, regardless of
  // how the local event bus schedules subscriber execution internally.
  void emitOrderIngestionCreatedEventWorkflow(req.scope)
    .run({ input: { order_id: order.id } })
    .catch((error: Error) => {
      logger.error(
        `Failed to emit order_ingestion.order_created for order ${order.id}: ${error.message}`
      );
    });

  res.status(201).json({
    order_id: order.id,
    status: order.status,
  });
}
