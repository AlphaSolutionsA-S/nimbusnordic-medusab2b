import { authenticate } from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";

export const storeBusinessCentralMiddlewares: MiddlewareRoute[] = [
  {
    method: "ALL",
    matcher: "/store/business-central*",
    //middlewares: [authenticate("customer", ["session", "bearer"])],
    middlewares: [ ],
  },
];
