import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { sendWorkflowResult } from "../../utils/workflow-error-response";
import { publishCountryLanguagesWorkflow } from "../../../workflows/storefront-translation/workflows/publish-country-languages";

// Public by design (publishable key enforced by the framework for /store): only country, locale
// and source are published. no-store keeps a stale mapping out of shared caches.
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  await sendWorkflowResult(res, () => publishCountryLanguagesWorkflow(req.scope).run({}));
}
