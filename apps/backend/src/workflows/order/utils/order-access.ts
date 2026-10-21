import {
  hasApprovedAdminApproval,
  hasVerifiedCartAssociation,
  type AccessCaller,
  type CartWithApprovals,
} from "../../cart/utils/cart-access";

/** Reading an order and creating a return for it follow the same rule (NIMBUS-177). */
export type OrderOperation = "read" | "return";

export interface OrderAccessFacts {
  caller: AccessCaller;
  order: { customer_id: string | null };
  /** The cart the order was completed from (core order–cart link); null when there is none. */
  source_cart: CartWithApprovals | null;
  /** The order owner's current employee company; null when the owner has no employee record. */
  owner_company_id: string | null;
}

/**
 * The owner always (also after leaving the company). An administrator only through the source
 * cart: it belongs to the order's owner, its company is the administrator's and still the owner's
 * company, and its admin approval is approved. The order–company link is never consulted: storefront
 * orders get it from client metadata.
 */
export function canAccessOrder(facts: OrderAccessFacts): boolean {
  const { caller, order, source_cart: cart } = facts;
  if (!order.customer_id) {
    return false;
  }
  if (order.customer_id === caller.id) {
    return true;
  }

  const employee = caller.employee;
  if (!employee?.is_admin || !cart || cart.customer_id !== order.customer_id ||
    !hasVerifiedCartAssociation(cart, facts.owner_company_id) ||
    cart.company_id !== employee.company_id) {
    return false;
  }
  return hasApprovedAdminApproval(cart);
}
