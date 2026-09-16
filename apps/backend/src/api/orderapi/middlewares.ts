import {
  authenticate,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import { CanonicalOrderSchema } from "../../modules/order-ingestion/canonical-order-schema";
import { OrderApiOrdersQuerySchema } from "./orders/validators";

export const orderApiMiddlewares: MiddlewareRoute[] = [
  {
    method: "ALL",
    matcher: "/orderapi/orders*",
    // Secret API key only (HTTP Basic auth: `Authorization: Basic <sk_...>`). This key is
    // issued to and used exclusively by the Logic App — an internal Azure credential, never
    // distributed to external B2B customer systems — so authenticating it as a full Medusa
    // admin user (Medusa's only supported secret-API-key actor type) is an accepted trade-off.
    middlewares: [authenticate("user", ["api-key"])],
  },
  {
    method: ["POST"],
    matcher: "/orderapi/orders",
    middlewares: [
      validateAndTransformQuery(OrderApiOrdersQuerySchema, {}),
      validateAndTransformBody(CanonicalOrderSchema),
    ],
  },
];
