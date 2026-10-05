import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { getOrderDetailWorkflow } from "@medusajs/medusa/core-flows";
import { BC_INTEGRATION_STATE_METADATA_KEY } from "../../../../../modules/order-ingestion/bc-integration-state";
import { toAdminBcIntegration } from "../../../../../workflows/business-central-order/utils/admin-bc-integration";
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { result: order } = await getOrderDetailWorkflow(req.scope).run({
    input: { order_id: req.params.id, fields: ["id", "metadata"] },
  });
  res.json({
    bc_integration: toAdminBcIntegration(
      order.metadata?.[BC_INTEGRATION_STATE_METADATA_KEY]
    ),
  });
};
