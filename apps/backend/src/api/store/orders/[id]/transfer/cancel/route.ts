import { cancelOrderTransferRequestWorkflow } from "@medusajs/core-flows";
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";

// Replaces core's handler, which answered with the full order (NIMBUS-177); core's authentication
// still runs and core's workflow still lets only the requester cancel.
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> => {
  await cancelOrderTransferRequestWorkflow(req.scope).run({
    input: {
      order_id: req.params.id,
      logged_in_user_id: req.auth_context.actor_id,
      // Core passes `auth_context.actor_type`; its customer-only authentication makes that this.
      actor_type: "customer",
    },
  });
  res.status(200).json({ success: true });
};
