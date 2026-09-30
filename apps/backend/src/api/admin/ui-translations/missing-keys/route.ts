import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import type { MissingKeyRecord } from "../../../../types/storefront-translation";
import { translationService } from "../helpers";
import type { MissingListQuery } from "../validators";

// Lists open (not dismissed) reports, including outage notices for locales without a row yet.
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { locale, offset, limit } = req.validatedQuery as MissingListQuery;
  const [rows, count] = await translationService(req).listAndCountTranslationMissingKeys(
    { dismissed: false, ...(locale ? { locale } : {}) },
    { skip: offset, take: limit, order: { last_seen_at: "DESC" } }
  );
  const missing_keys: MissingKeyRecord[] = rows.map((row) => ({
    id: row.id,
    locale: row.locale,
    key: row.key,
    count: Number(row.count),
    first_seen_at: new Date(row.first_seen_at).toISOString(),
    last_seen_at: new Date(row.last_seen_at).toISOString(),
    last_page_path: row.last_page_path,
    dismissed: row.dismissed,
  }));
  res.json({ missing_keys, count, offset, limit });
}
