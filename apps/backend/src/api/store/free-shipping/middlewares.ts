import { validateAndTransformQuery } from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import { ensureCartAccess } from "../../middlewares/ensure-cart-access";
import { StoreGetFreeShippingPricesParams } from "./validators";

export const storeFreeShippingMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/free-shipping/prices",
    middlewares: [
      validateAndTransformQuery(StoreGetFreeShippingPricesParams, {
        defaultLimit: 20,
        isList: true,
      }),
      ...ensureCartAccess("read", "query"),
    ],
  },
];
