import { timingSafeEqual } from "node:crypto";
import { validateAndTransformBody } from "@medusajs/framework";
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MiddlewareRoute } from "@medusajs/medusa";
import { MAX_REPORT_BODY_BYTES } from "../../../../utils/translations/validation";
import { MissingReportBatchSchema } from "./validators";

// Server-to-server only: the storefront server forwards reports with a dedicated secret.
// Neither a publishable key nor a customer token grants access. Missing configuration fails closed.
export function verifyTranslationReportSecret(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  const configured = process.env.TRANSLATION_REPORT_SECRET ?? "";
  const header = req.headers.authorization ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const expected = Buffer.from(configured);
  const actual = Buffer.from(supplied);
  if (!configured || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    res.status(401).json({ type: "unauthorized", message: "Unauthorized" });
    return;
  }
  next();
}

export const internalUiTranslationsMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/internal/ui-translations/missing-keys",
    bodyParser: { sizeLimit: MAX_REPORT_BODY_BYTES },
    middlewares: [verifyTranslationReportSecret, validateAndTransformBody(MissingReportBatchSchema)],
  },
];
