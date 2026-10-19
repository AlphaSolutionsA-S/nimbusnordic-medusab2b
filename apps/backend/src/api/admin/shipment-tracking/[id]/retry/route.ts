import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { reopenShipmentTrackingWorkflow } from "../../../../../workflows/shipment-notice/workflows/reopen-shipment-tracking";
import type { AdminShipmentTrackingRetryType } from "../../middlewares";

export async function POST(req: AuthenticatedMedusaRequest<AdminShipmentTrackingRetryType>, res: MedusaResponse): Promise<void> {
  const { result } = await reopenShipmentTrackingWorkflow(req.scope).run({
    input: { id: req.params.id, actor_id: req.auth_context.actor_id },
  });
  res.json({ shipment_tracking: result });
}
