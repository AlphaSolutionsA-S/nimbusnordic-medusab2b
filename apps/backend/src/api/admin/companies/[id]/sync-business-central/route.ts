import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";

import type { AdminSyncCompanyBusinessCentralResponse } from "../../../../../types";
import { syncCompanyFromBusinessCentralWorkflow } from "../../../../../workflows/company/workflows/sync-company-from-business-central";
import type { AdminSyncCompanyBusinessCentralType } from "../../validators";

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminSyncCompanyBusinessCentralType>,
  res: MedusaResponse<AdminSyncCompanyBusinessCentralResponse>
): Promise<void> => {
  // An unknown id rejects as not_found in the workflow, which Medusa maps to 404.
  const { result } = await syncCompanyFromBusinessCentralWorkflow(
    req.scope
  ).run({
    input: { companyId: req.params.id },
  });

  res.status(200).json({ status: result.status });
};
