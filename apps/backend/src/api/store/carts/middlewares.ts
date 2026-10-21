import {
  authenticate,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import { ensureCartAccess } from "../../middlewares/ensure-cart-access";
import { ensureCartEditable } from "../../middlewares/ensure-cart-editable";
import type { CartOperation } from "../../../workflows/cart/utils/cart-access";
import { retrieveCartTransformQueryConfig } from "./query-config";
import {
  GetCartLineItemsBulkParams,
  StoreAddLineItemsBulk,
} from "./validators";

type Method = "GET" | "POST" | "DELETE";

// Every cart route by ID and its operation class (NIMBUS-177). These entries come before the
// `ensureCartEditable` entries below, so the access check runs first on the same matcher.
const GUARDED_CART_ROUTES: [Method[], string, CartOperation][] = [
  [["GET"], "/store/carts/:id", "read"],
  [["POST"], "/store/carts/:id", "owner"],
  [["POST"], "/store/carts/:id/customer", "owner"],
  [["POST"], "/store/carts/:id/line-items", "owner"],
  [["POST", "DELETE"], "/store/carts/:id/line-items/:line_id", "owner"],
  [["POST"], "/store/carts/:id/line-items/bulk", "owner"],
  [["POST", "DELETE"], "/store/carts/:id/promotions", "owner"],
  [["POST"], "/store/carts/:id/shipping-methods", "owner"],
  [["POST"], "/store/carts/:id/taxes", "owner"],
  [["POST"], "/store/carts/:id/approvals", "owner"],
  [["POST"], "/store/carts/:id/complete", "pay"],
];

export const storeCartsMiddlewares: MiddlewareRoute[] = [
  // Carts are personal (NIMBUS-177): only a signed-in customer may create one.
  {
    method: ["POST"],
    matcher: "/store/carts",
    middlewares: [authenticate("customer", ["bearer", "session"])],
  },
  ...GUARDED_CART_ROUTES.map(([method, matcher, operation]): MiddlewareRoute => ({
    method,
    matcher,
    middlewares: ensureCartAccess(operation),
  })),
  ...[
    "/store/carts/:id",
    "/store/carts/:id/customer",
    "/store/carts/:id/line-items",
    "/store/carts/:id/line-items/:line_id",
    "/store/carts/:id/promotions",
    "/store/carts/:id/shipping-methods",
  ].map((matcher): MiddlewareRoute => ({
    method: ["POST", "DELETE"],
    matcher,
    middlewares: [ensureCartEditable],
  })),
  {
    method: ["POST"],
    matcher: "/store/carts/:id/line-items/bulk",
    middlewares: [
      ensureCartEditable,
      validateAndTransformBody(StoreAddLineItemsBulk),
      validateAndTransformQuery(
        GetCartLineItemsBulkParams,
        retrieveCartTransformQueryConfig
      ),
    ],
  },
];
