import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaResponse,
} from "@medusajs/framework";
import { authorizeCompanyAccessWorkflow } from "../../workflows/company/workflows/authorize-company-access";

export function ensureCompanyAccess(requireAdmin: boolean, useCompanyParam = true) {
  return async (
    req: AuthenticatedMedusaRequest,
    _res: MedusaResponse,
    next: MedusaNextFunction
  ): Promise<void> => {
    await authorizeCompanyAccessWorkflow(req.scope).run({
      input: {
        customer_id: req.auth_context.actor_id,
        company_id: useCompanyParam ? req.params.id : undefined,
        employee_id: req.params.employeeId,
        require_admin: requireAdmin,
      },
    });
    next();
  };
}
