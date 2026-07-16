import { authenticate, validateAndTransformQuery } from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import { StoreBCOrdersQuery } from "./validators";

export const storeBCOrdersMiddlewares: MiddlewareRoute[] = [
  {
    method: "ALL",
    matcher: "/store/bc-orders*",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["GET"],
    matcher: "/store/bc-orders",
    middlewares: [
      validateAndTransformQuery(StoreBCOrdersQuery, {
        defaults: [
          "limit",
          "offset",
          "status",
          "date_from",
          "date_to",
          "search",
        ],
        isList: true,
      }),
    ],
  },
];
