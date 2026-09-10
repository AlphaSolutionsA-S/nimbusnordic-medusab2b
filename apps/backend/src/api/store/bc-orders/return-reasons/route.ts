import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { BUSINESS_CENTRAL_MODULE } from "../../../../modules/business-central";
import type { IBusinessCentralModuleService } from "../../../../modules/business-central/types";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> => {
  const bcService = req.scope.resolve<IBusinessCentralModuleService>(
    BUSINESS_CENTRAL_MODULE
  );
  const returnReasons = await bcService.listReturnReasons();

  res.json({ return_reasons: returnReasons });
};
