import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { dismissMissingTranslationWorkflow } from "../../../../../../../workflows/storefront-translation/workflows/dismiss-missing-translation";
import { localeParam, missingIdParam } from "../../../../helpers";

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await dismissMissingTranslationWorkflow(req.scope).run({
    input: { locale: localeParam(req), id: missingIdParam(req) },
  });
  res.json(result);
}
