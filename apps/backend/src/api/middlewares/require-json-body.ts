import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

/**
 * Refuses bodies that are not application/json with 415. A foreign page can send text/plain or
 * form bodies with the dashboard's cookie without a CORS preflight; JSON requires one, and the
 * Admin CORS allow-list refuses foreign origins.
 */
export function requireJsonBody(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  if (req.is("application/json") !== "application/json") {
    res.status(415).json({
      type: "unsupported_media_type",
      message: "Request body must be application/json",
    });
    return;
  }
  next();
}
