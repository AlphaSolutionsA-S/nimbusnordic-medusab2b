import { MiddlewareRoute } from "@medusajs/medusa";
import { ensureOrderAccess } from "../../middlewares/ensure-order-access";

// Core leaves the order read unauthenticated, treating the ID as the credential (NIMBUS-177).
// Transfer request and cancel stay on core's authentication; their route files return no order.
export const storeOrdersMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/orders/:id",
    middlewares: ensureOrderAccess("read"),
  },
];
