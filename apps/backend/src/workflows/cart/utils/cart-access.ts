import type { ApprovalStatusType, ApprovalType } from "../../../types/approval";

export type CartOperation = "read" | "owner" | "pay";

export interface CartAccessCart {
  customer_id: string | null;
  company_id: string | null;
}

export interface CartAccessFacts {
  caller: { id: string; employee: { company_id: string; is_admin: boolean } | null };
  cart: CartAccessCart & { approvals: { type: string; status: string }[] };
  /** The owner's current employee company; null when the owner has no employee record. */
  owner_company_id: string | null;
}

const ADMIN_APPROVAL: `${ApprovalType.ADMIN}` = "admin";
const APPROVED: `${ApprovalStatusType.APPROVED}` = "approved";

/**
 * The cart has an owner and its company link equals the owner's current company, or it has no link
 * and the owner has no employee record. Anything else is ambiguous and refused for everyone
 * (NIMBUS-177): a legacy link written from client metadata is never trusted on its own.
 */
export function hasVerifiedCartAssociation(
  cart: CartAccessCart,
  ownerCompanyId: string | null,
): boolean {
  if (!cart.customer_id) {
    return false;
  }
  return cart.company_id ? cart.company_id === ownerCompanyId : ownerCompanyId === null;
}

export function canAccessCart(operation: CartOperation, facts: CartAccessFacts): boolean {
  const { caller, cart } = facts;
  if (!hasVerifiedCartAssociation(cart, facts.owner_company_id)) {
    return false;
  }
  if (cart.customer_id === caller.id) {
    return true;
  }

  const employee = caller.employee;
  if (operation === "owner" || !employee?.is_admin || !cart.company_id ||
    employee.company_id !== cart.company_id) {
    return false;
  }
  const adminApprovals = cart.approvals.filter((approval) => approval.type === ADMIN_APPROVAL);
  return operation === "read"
    ? adminApprovals.length > 0
    : adminApprovals.some((approval) => approval.status === APPROVED);
}
