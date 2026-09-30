import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { localeParam, respondWithMutation } from "../../helpers";
import type { ActivationBody } from "../../validators";

export async function POST(
  req: AuthenticatedMedusaRequest<ActivationBody>,
  res: MedusaResponse
): Promise<void> {
  await respondWithMutation(req, res, {
    operation: "activate",
    locale: localeParam(req),
    expected_version: req.validatedBody.expected_version,
    is_active: req.validatedBody.is_active,
  });
}
