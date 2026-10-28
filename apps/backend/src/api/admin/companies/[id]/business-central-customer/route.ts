import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";

import type { AdminBusinessCentralCustomerResponse } from "../../../../../types";
import { resolveBusinessCentralAccountWorkflow } from "../../../../../workflows/company/workflows/resolve-business-central-account";
import { toAdminBusinessCentralCustomer } from "./response";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse<AdminBusinessCentralCustomerResponse>
): Promise<void> => {
  // An unknown id rejects as not_found in the workflow, which Medusa maps to 404.
  const { result } = await resolveBusinessCentralAccountWorkflow(req.scope).run({
    input: { companyId: req.params.id },
  });

  res.status(200).json(toAdminBusinessCentralCustomer(result));
};
