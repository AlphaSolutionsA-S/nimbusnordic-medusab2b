import {
  authenticate,
  validateAndTransformQuery,
} from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import { StoreBCReturnsQuery } from "./validators";

export const storeBCReturnsMiddlewares: MiddlewareRoute[] = [
  {
    method: "ALL",
    matcher: "/store/bc-returns*",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["GET"],
    matcher: "/store/bc-returns",
    middlewares: [
      validateAndTransformQuery(StoreBCReturnsQuery, {
        defaults: [
          "limit",
          "offset",
          "state",
          "date_from",
          "date_to",
          "search",
        ],
        isList: true,
      }),
    ],
  },
];
