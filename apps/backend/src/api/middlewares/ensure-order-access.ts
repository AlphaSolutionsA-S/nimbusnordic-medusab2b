import {
  authenticate,
  type AuthenticatedMedusaRequest,
  type MedusaNextFunction,
  type MedusaResponse,
  type MiddlewareFunction,
} from "@medusajs/framework/http";
import type { OrderOperation } from "../../workflows/order/utils/order-access";
import { authorizeOrderAccessWorkflow } from "../../workflows/order/workflows/authorize-order-access";

/** Where the route takes its order from: the `:id` path parameter or the validated body `order_id`. */
export type OrderIdSource = "path" | "body";

function orderReference(req: AuthenticatedMedusaRequest, source: OrderIdSource): unknown {
  return source === "path"
    ? req.params.id
    : (req.validatedBody as { order_id?: unknown } | undefined)?.order_id;
}

/**
 * Customer authentication plus the order access check (NIMBUS-177) for one route, placed after the
 * route's validators so `body` reads the validated `order_id`. Refusal and a missing order answer
 * the same 404.
 */
export function ensureOrderAccess(
  operation: OrderOperation,
  source: OrderIdSource = "path"
): MiddlewareFunction[] {
  const guard = async (
    req: AuthenticatedMedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ): Promise<void> => {
    // Set before the check so a refusal is not cached either.
    res.setHeader("Cache-Control", "private, no-store");
    const orderId = orderReference(req, source);
    await authorizeOrderAccessWorkflow(req.scope).run({
      input: {
        customer_id: req.auth_context.actor_id,
        operation,
        order_id: typeof orderId === "string" ? orderId : "",
      },
    });
    next();
  };
  return [authenticate("customer", ["bearer", "session"]), guard];
}
