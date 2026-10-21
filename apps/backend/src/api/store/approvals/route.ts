import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { listCompanyApprovalCartsWorkflow } from "../../../workflows/approval/workflows/list-company-approval-carts";
import { StoreGetApprovalsType } from "./validators";

export const GET = async (
  req: AuthenticatedMedusaRequest<unknown, StoreGetApprovalsType>,
  res: MedusaResponse
) => {
  const { result } = await listCompanyApprovalCartsWorkflow(req.scope).run({
    input: {
      customer_id: req.auth_context.actor_id,
      status: req.validatedQuery.status,
      pagination: req.queryConfig.pagination,
    },
  });

  res.json({ carts_with_approvals: result.carts_with_approvals, ...result.metadata });
};
