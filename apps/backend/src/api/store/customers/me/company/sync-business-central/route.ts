import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";

import { syncCompanyFromBusinessCentralWorkflow } from "../../../../../../workflows/company/workflows/sync-company-from-business-central";

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> => {
  const { customer_id } = req.auth_context.app_metadata as {
    customer_id: string;
  };

  const { result } = await syncCompanyFromBusinessCentralWorkflow(
    req.scope
  ).run({
    input: { customerId: customer_id },
  });

  res.status(200).json({ status: result.status });
};
