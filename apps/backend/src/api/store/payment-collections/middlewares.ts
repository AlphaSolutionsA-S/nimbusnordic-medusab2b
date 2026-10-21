import { MiddlewareRoute } from "@medusajs/medusa";
import { ensureCartAccess } from "../../middlewares/ensure-cart-access";

// Core payment routes reach a cart through a body `cart_id` or a payment collection (NIMBUS-177).
// Core's validators run first, so the guard reads the validated id.
export const storePaymentCollectionsMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/payment-collections",
    middlewares: ensureCartAccess("pay", "body"),
  },
  {
    method: ["POST"],
    matcher: "/store/payment-collections/:id/payment-sessions",
    middlewares: ensureCartAccess("pay", "payment_collection"),
  },
];
