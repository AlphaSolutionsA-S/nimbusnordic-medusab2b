import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { localeParam, missingIdParam, respondWithMutation } from "../../../../helpers";
import type { ResolveMissingBody } from "../../../../validators";

export async function POST(
  req: AuthenticatedMedusaRequest<ResolveMissingBody>,
  res: MedusaResponse
): Promise<void> {
  await respondWithMutation(req, res, {
    operation: "resolve",
    locale: localeParam(req),
    expected_version: req.validatedBody.expected_version,
    missing_id: missingIdParam(req),
    value: req.validatedBody.value,
  });
}
