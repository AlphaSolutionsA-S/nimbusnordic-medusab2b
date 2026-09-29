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
        // Company fields are listed one by one: allowing the `company` relation would let any
        // employee select `*company` and read the admin-only financial fields.
        allowFields(
          "company.id",
          "company.name",
          "company.approval_settings",
          "approvals",
          "approval_status"
        ),
      ],
    },
  ],
});
