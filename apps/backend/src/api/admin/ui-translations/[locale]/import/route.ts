import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { localeParam, respondWithMutation } from "../../helpers";
import type { ImportTranslationBody } from "../../validators";

export async function POST(
  req: AuthenticatedMedusaRequest<ImportTranslationBody>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody;
  await respondWithMutation(
    req,
    res,
    {
      operation: "import",
      input: {
        locale: localeParam(req),
        expected_version: body.expected_version,
        mode: body.mode,
        messages: body.messages,
        confirm_removed: body.confirm_removed,
      },
    },
    body.expected_version === null ? 201 : 200
  );
}
