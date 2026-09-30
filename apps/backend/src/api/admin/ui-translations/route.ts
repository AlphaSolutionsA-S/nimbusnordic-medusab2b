import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import type { LocaleSummary } from "../../../types/storefront-translation";
import { respondWithMutation, translationService } from "./helpers";
import type { CreateTranslationBody } from "./validators";

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const rows = await translationService(req).listStorefrontTranslations(
    {},
    { select: ["id", "locale", "version", "is_active", "updated_at"], order: { locale: "ASC" } }
  );
  const locales: LocaleSummary[] = rows.map((row) => ({
    id: row.id,
    locale: row.locale,
    version: Number(row.version),
    is_active: row.is_active,
    updated_at: new Date(row.updated_at).toISOString(),
  }));
  res.json({ locales });
}

export async function POST(
  req: AuthenticatedMedusaRequest<CreateTranslationBody>,
  res: MedusaResponse
): Promise<void> {
  await respondWithMutation(req, res, { operation: "create", input: req.validatedBody }, 201);
}
