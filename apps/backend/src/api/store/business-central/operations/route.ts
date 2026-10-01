import type { MedusaRequest, MedusaResponse } from "@medusajs/framework";

export const GET = (_req: MedusaRequest, res: MedusaResponse): void => {
  res.status(404).end();
};

/* Disabled after the API security review: the raw Business Central discovery document
 * must not be exposed to storefront customers.
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { BUSINESS_CENTRAL_MODULE } from "../../../../modules/business-central";
import type { IBusinessCentralModuleService } from "../../../../modules/business-central/types";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const businessCentralService =
    req.scope.resolve<IBusinessCentralModuleService>(BUSINESS_CENTRAL_MODULE);

  const operations = await businessCentralService.getOperations();

  res.json({
    operations,
  });
};
*/
