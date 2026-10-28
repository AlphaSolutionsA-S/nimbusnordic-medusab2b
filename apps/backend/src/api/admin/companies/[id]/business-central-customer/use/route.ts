import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";

import type { AdminUseBusinessCentralCustomerResponse } from "../../../../../../types";
import { useBusinessCentralCustomerWorkflow } from "../../../../../../workflows/company/workflows/use-business-central-customer";
import type { AdminUseBusinessCentralCustomerType } from "../../../validators";

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUseBusinessCentralCustomerType>,
  res: MedusaResponse<AdminUseBusinessCentralCustomerResponse>
): Promise<void> => {
  // Unknown company or no card in that environment → not_found (404), no customer number →
  // invalid_data (400); nothing is written in either case.
  const { result } = await useBusinessCentralCustomerWorkflow(req.scope).run({
    input: { companyId: req.params.id, environment: req.validatedBody.environment },
  });

  res.status(200).json({ status: result.status, country: result.country });
};
