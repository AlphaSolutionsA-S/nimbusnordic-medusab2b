import {
  authenticate,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import { ensureCartEditable } from "../../middlewares/ensure-cart-editable";
import { retrieveCartTransformQueryConfig } from "./query-config";
import {
  GetCartLineItemsBulkParams,
  StoreAddLineItemsBulk,
} from "./validators";

export const storeCartsMiddlewares: MiddlewareRoute[] = [
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
  {
    method: ["POST"],
    matcher: "/store/carts/:id/approvals",
    middlewares: [authenticate("customer", ["bearer", "session"])],
  },
];
