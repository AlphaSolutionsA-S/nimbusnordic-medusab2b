import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import type { StoreRequestOrderTransferType } from "@medusajs/medusa/api/store/orders/validators";
import { requestTransferableOrderTransferWorkflow } from "../../../../../../workflows/order/workflows/request-order-transfer";

// Replaces core's handler, which answered with the full order (NIMBUS-177); core's authentication
// and body validation still run.
export const POST = async (
  req: AuthenticatedMedusaRequest<StoreRequestOrderTransferType>,
  res: MedusaResponse
): Promise<void> => {
  const customerId = req.auth_context.actor_id;
  await requestTransferableOrderTransferWorkflow(req.scope).run({
    input: {
      order_id: req.params.id,
      customer_id: customerId,
      logged_in_user: customerId,
      description: req.validatedBody.description,
      update_order_email: req.validatedBody.update_order_email,
    },
  });
  res.status(200).json({ success: true });
};
