import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http";
import type { MedusaRequest, MedusaResponse, MedusaNextFunction, MiddlewareRoute } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { AdminShipmentTrackingOverviewQuery, AdminShipmentTrackingParams, AdminShipmentTrackingQuery, AdminShipmentTrackingRetry } from "./validators";

function validateTrackingParams(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction): void {
  const parsed = AdminShipmentTrackingParams.safeParse(req.params);
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid shipment tracking id");
  }
  next();
}

export const adminShipmentTrackingMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/shipment-tracking", method: "GET",
    middlewares: [validateAndTransformQuery(AdminShipmentTrackingQuery, {})],
  },
  {
    matcher: "/admin/shipment-tracking/overview", method: "GET",
    middlewares: [validateAndTransformQuery(AdminShipmentTrackingOverviewQuery, {})],
  },
  {
    matcher: "/admin/shipment-tracking/:id/retry", method: "POST",
    middlewares: [validateTrackingParams, validateAndTransformQuery(AdminShipmentTrackingRetry, {}), validateAndTransformBody(AdminShipmentTrackingRetry)],
  },
];
export { AdminShipmentTrackingOverviewQuery, AdminShipmentTrackingQuery, AdminShipmentTrackingRetry } from "./validators";
export type { AdminShipmentTrackingOverviewQueryType, AdminShipmentTrackingQueryType, AdminShipmentTrackingRetryType } from "./validators";
