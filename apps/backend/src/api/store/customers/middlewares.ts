import { validateAndTransformBody } from "@medusajs/framework";
import { authenticate, MiddlewareRoute } from "@medusajs/medusa";
import { StoreUpdatePassword } from "./me/password/validators";

export const storeCustomersMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/customers/me/password",
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
      validateAndTransformBody(StoreUpdatePassword),
    ],
  },
];
