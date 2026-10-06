import { validateAndTransformBody } from "@medusajs/framework/http";
import type { MiddlewareRoute } from "@medusajs/framework/http";
import { AdminSubmitOrderToBc } from "./validators";
export const adminBcIntegrationMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/orders/:id/bc-integration/submit",
    middlewares: [validateAndTransformBody(AdminSubmitOrderToBc)],
  },
];
export { AdminSubmitOrderToBc } from "./validators";
export type { AdminSubmitOrderToBcType } from "./validators";
