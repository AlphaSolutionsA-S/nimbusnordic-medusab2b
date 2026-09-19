import { allowFields } from "@medusajs/framework/http";
import { defineMiddlewares } from "@medusajs/medusa";
import { adminMiddlewares } from "./admin/middlewares";
import { storeMiddlewares } from "./store/middlewares";
import { orderApiMiddlewares } from "./orderapi/middlewares";

export default defineMiddlewares({
  routes: [
    ...adminMiddlewares,
    ...storeMiddlewares,
    ...orderApiMiddlewares,
    {
      matcher: "/store/customers/me",
      middlewares: [allowFields("employee")],
    },
    {
      matcher: "/store/carts/:id",
      middlewares: [
        allowFields(
          "company",
          "company.approval_settings",
          "approvals",
          "approval_status"
        ),
      ],
    },
  ],
});
