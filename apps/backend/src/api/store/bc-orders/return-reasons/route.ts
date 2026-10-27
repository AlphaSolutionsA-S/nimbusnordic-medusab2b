import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { BUSINESS_CENTRAL_MODULE } from "../../../../modules/business-central";
import type { IBusinessCentralModuleService } from "../../../../modules/business-central/types";
import { resolveBusinessCentralAccountWorkflow } from "../../../../workflows/company/workflows/resolve-business-central-account";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> => {
  const { customer_id } = req.auth_context.app_metadata as {
    customer_id: string;
  };
  const { result: account } = await resolveBusinessCentralAccountWorkflow(
    req.scope
  ).run({ input: { customerId: customer_id } });

  const bcService = req.scope.resolve<IBusinessCentralModuleService>(
    BUSINESS_CENTRAL_MODULE
  );
  const returnReasons = await bcService.listReturnReasons(account.environment);

  res.json({ return_reasons: returnReasons });
};
