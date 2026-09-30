import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { localeParam, translationService } from "../../helpers";

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const locale = localeParam(req);
  const [row] = await translationService(req).listStorefrontTranslations(
    { locale },
    { select: ["messages"] }
  );
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Language "${locale}" was not found`);
  }
  // Canonical locales contain only letters, digits and hyphens, so the filename needs no escaping.
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${locale}.json"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(`${JSON.stringify(row.messages, null, 2)}\n`);
}
