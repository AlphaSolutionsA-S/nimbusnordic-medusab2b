import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { sendWorkflowResult } from "../../utils/workflow-error-response";
import { getCountryLanguageManagementWorkflow } from "../../../workflows/storefront-translation/workflows/get-country-language-management";

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await sendWorkflowResult(res, () => getCountryLanguageManagementWorkflow(req.scope).run({}));
}
