import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { STOREFRONT_TRANSLATION_MODULE } from "../../../../modules/storefront-translation";
import type StorefrontTranslationModuleService from "../../../../modules/storefront-translation/service";
import { toTranslationDocument } from "../../../../modules/storefront-translation/service";
import type { MessageDocument } from "../../../../types/storefront-translation";
import { canonicalizeLocale } from "../../../../utils/translations/validation";

// The SDK keeps only status and message from error bodies, so message carries the stable code.
function notFound(res: MedusaResponse, code: "translation_not_found" | "translation_inactive"): void {
  res.setHeader("Cache-Control", "no-store");
  res.status(404).json({ type: "not_found", code, message: code });
}

// Public UI copy: publishable key only (enforced for /store by the framework), no customer login.
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const locale = canonicalizeLocale(String(req.params.locale ?? ""));
  if (!locale) {
    notFound(res, "translation_not_found");
    return;
  }
  const service = req.scope.resolve<StorefrontTranslationModuleService>(STOREFRONT_TRANSLATION_MODULE);
  const [row] = await service.listStorefrontTranslations(
    { locale },
    { select: ["id", "locale", "messages", "version", "is_active", "updated_at"] }
  );
  if (!row) {
    notFound(res, "translation_not_found");
    return;
  }
  if (!row.is_active) {
    notFound(res, "translation_inactive");
    return;
  }
  res.json({
    translation: toTranslationDocument({ ...row, messages: row.messages as MessageDocument }),
  });
}
