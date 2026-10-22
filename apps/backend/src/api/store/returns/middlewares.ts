import { MiddlewareRoute } from "@medusajs/medusa";
import { ensureOrderAccess } from "../../middlewares/ensure-order-access";

// Core creates and completes a return for any body `order_id` without sign-in (NIMBUS-177).
// Core's body validator runs first, so the guard reads the validated id.
export const storeReturnsMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/returns",
    middlewares: ensureOrderAccess("return", "body"),
  },
];
