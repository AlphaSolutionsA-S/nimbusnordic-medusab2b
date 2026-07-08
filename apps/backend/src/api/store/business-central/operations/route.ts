import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { getBusinessCentralOperations } from "../../../../utils/business-central-client";

export const GET = async (
  _req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const operations = await getBusinessCentralOperations();

  res.json({
    operations,
  });
};
