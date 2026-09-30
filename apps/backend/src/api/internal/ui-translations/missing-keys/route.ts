import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { reportMissingTranslationsWorkflow } from "../../../../workflows/storefront-translation/workflows/report-missing-translations";
import type { MissingReportBatch } from "./validators";

export async function POST(
  req: MedusaRequest<MissingReportBatch>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await reportMissingTranslationsWorkflow(req.scope).run({
    input: req.validatedBody.reports,
  });
  res.status(202).json(result);
}
