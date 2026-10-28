import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";

import type { AdminBusinessCentralCustomerLookupResponse } from "../../../../../../types";
import { lookupBusinessCentralCustomerWorkflow } from "../../../../../../workflows/company/workflows/lookup-business-central-customer";
import { toAdminBusinessCentralCustomerLookup } from "../response";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse<AdminBusinessCentralCustomerLookupResponse>
): Promise<void> => {
  // Unknown company → not_found (404); no customer number → invalid_data (400), both from the
  // workflow before any Business Central call.
  const { result } = await lookupBusinessCentralCustomerWorkflow(req.scope).run({
    input: { companyId: req.params.id },
  });

  res.status(200).json(toAdminBusinessCentralCustomerLookup(result));
};
