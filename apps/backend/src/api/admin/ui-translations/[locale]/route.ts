import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { toTranslationDocument } from "../../../../modules/storefront-translation/service";
import type { MessageDocument } from "../../../../types/storefront-translation";
import { localeParam, respondWithMutation, translationService } from "../helpers";
import type { SaveTranslationBody } from "../validators";

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const locale = localeParam(req);
  const [row] = await translationService(req).listStorefrontTranslations(
    { locale },
    { select: ["id", "locale", "messages", "version", "is_active", "updated_at"] }
  );
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Language "${locale}" was not found`);
  }
  res.json({
    translation: toTranslationDocument({ ...row, messages: row.messages as MessageDocument }),
  });
}

export async function POST(
  req: AuthenticatedMedusaRequest<SaveTranslationBody>,
  res: MedusaResponse
): Promise<void> {
  await respondWithMutation(req, res, {
    operation: "save",
    locale: localeParam(req),
    expected_version: req.validatedBody.expected_version,
    messages: req.validatedBody.messages,
  });
}
