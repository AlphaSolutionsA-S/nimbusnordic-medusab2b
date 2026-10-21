import {
  authenticate,
  type AuthenticatedMedusaRequest,
  type MedusaNextFunction,
  type MedusaResponse,
  type MiddlewareFunction,
} from "@medusajs/framework/http";
import type { CartAccessInput } from "../../workflows/cart/steps/validate-cart-access";
import type { CartOperation } from "../../workflows/cart/utils/cart-access";
import { authorizeCartAccessWorkflow } from "../../workflows/cart/workflows/authorize-cart-access";

/**
 * Where the route takes its cart from: the `:id` path parameter, the validated body or query
 * `cart_id`, or the `:id` of a payment collection (resolved to its cart by the workflow).
 */
export type CartIdSource = "path" | "body" | "query" | "payment_collection";

function asId(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function cartReference(
  req: AuthenticatedMedusaRequest,
  source: CartIdSource
): Pick<CartAccessInput, "cart_id" | "payment_collection_id"> {
  switch (source) {
    case "path":
      return { cart_id: asId(req.params.id) };
    case "body":
      return { cart_id: asId((req.validatedBody as { cart_id?: unknown } | undefined)?.cart_id) };
    case "query":
      return { cart_id: asId(req.filterableFields?.cart_id) };
    case "payment_collection":
      return { payment_collection_id: asId(req.params.id) };
  }
}

/**
 * Customer authentication plus the cart access check (NIMBUS-177) for one route. Placed after the
 * route's request validators, so `body` and `query` read the same validated `cart_id` the route
 * uses, and before `ensureCartEditable`, so a caller without access never learns a cart's
 * approval state. Refusal and a missing cart answer the same 404.
 */
export function ensureCartAccess(
  operation: CartOperation,
  source: CartIdSource = "path"
): MiddlewareFunction[] {
  const guard = async (
    req: AuthenticatedMedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ): Promise<void> => {
    // Set before the check so a refusal is not cached either.
    res.setHeader("Cache-Control", "private, no-store");
    await authorizeCartAccessWorkflow(req.scope).run({
      input: { customer_id: req.auth_context.actor_id, operation, ...cartReference(req, source) },
    });
    next();
  };
  return [authenticate("customer", ["bearer", "session"]), guard];
}
