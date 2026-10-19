import type { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import {
  listShipmentNoticesWorkflow,
} from "../../../workflows/shipment-notice/workflows/list-shipment-notices";
import type { OrderApiShipmentNoticesQuery } from "./validators";

export async function GET(
  req: MedusaRequest<unknown, OrderApiShipmentNoticesQuery>,
  res: MedusaResponse
): Promise<void> {
  const { customerNumber, after, since, limit } = req.validatedQuery;

  // An unknown customer number rejects with a generic 404 from the workflow; no try/catch here.
  const { result } = await listShipmentNoticesWorkflow(req.scope).run({
    input: {
      customer_number: customerNumber,
      limit,
      after: after ?? null,
      since: since ?? null,
    },
  });

  res.status(200).json(result);
}
