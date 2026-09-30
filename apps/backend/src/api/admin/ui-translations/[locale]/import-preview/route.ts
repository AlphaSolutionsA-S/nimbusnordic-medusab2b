import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { localeParam, translationService } from "../../helpers";
import type { ImportPreviewBody } from "../../validators";

// A POST read: validates and diffs at the loaded version without writing anything.
export async function POST(
  req: AuthenticatedMedusaRequest<ImportPreviewBody>,
  res: MedusaResponse
): Promise<void> {
  const preview = await translationService(req).previewImport({
    locale: localeParam(req),
    ...req.validatedBody,
  });
  res.json(preview);
}
