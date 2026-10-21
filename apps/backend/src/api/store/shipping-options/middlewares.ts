import { MiddlewareRoute } from "@medusajs/medusa";
import { ensureCartAccess } from "../../middlewares/ensure-cart-access";

// Cart-scoped shipping options are a cart read (NIMBUS-177). Core's validators run first, so the
// guard reads the same validated `cart_id` the core route uses.
export const storeShippingOptionsMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/shipping-options",
    middlewares: ensureCartAccess("read", "query"),
  },
  {
    method: ["POST"],
    matcher: "/store/shipping-options/:id/calculate",
    middlewares: ensureCartAccess("read", "body"),
  },
];
