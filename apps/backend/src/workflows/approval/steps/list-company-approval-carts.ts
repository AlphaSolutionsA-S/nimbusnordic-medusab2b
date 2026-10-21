import type { RemoteQueryFilters } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ApprovalType } from "../../../types/approval";
import { hasVerifiedCartAssociation } from "../../cart/utils/cart-access";

export interface ListCompanyApprovalCartsInput {
  customer_id: string;
  /** The `status` query value as `StoreGetApprovals` validates it: a string, an array or an operator map. */
  status?: string | string[] | Record<string, unknown>;
  pagination?: { order?: Record<string, string>; skip: number; take?: number };
}

const CART_FIELDS = [
  "carts.*",
  "carts.approval_status.*",
  "carts.company.approval_settings.*",
  "carts.company.*",
  "carts.items.*",
  "carts.completed_at",
];

// The validator accepts any string for `status`; the database simply matches nothing for a value
// outside the enum, so the client value is passed through unchanged.
function approvalStatusFilter(
  status: NonNullable<ListCompanyApprovalCartsInput["status"]>,
): RemoteQueryFilters<"approval_status">["status"] {
  return status as RemoteQueryFilters<"approval_status">["status"];
}

/**
 * The caller's company carts that carry an admin approval, limited to carts whose association is
 * verified (NIMBUS-177): a cart whose owner left the company or whose link differs from the
 * owner's current company is never shown to an administrator.
 */
export const listCompanyApprovalCartsStep = createStep(
  "list-company-approval-carts",
  async (input: ListCompanyApprovalCartsInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const { data: [caller] } = await query.graph({
      entity: "customer",
      fields: ["employee.company_id"],
      filters: { id: input.customer_id },
    });
    const companyId = caller?.employee?.company_id;

    // Deliberate exemption from data-core-read-workflows: core-flows has no workflow that lists
    // carts by a custom company link.
    const { data: [company] } = companyId
      ? await query.graph({ entity: "company", fields: CART_FIELDS, filters: { id: companyId } })
      : { data: [] };
    const companyCarts = (company?.carts ?? []).filter((cart) => cart !== null);

    const ownerIds = [...new Set(companyCarts.flatMap((cart) => cart.customer_id ?? []))];
    const { data: owners } = ownerIds.length
      ? await query.graph({
        entity: "customer",
        fields: ["id", "employee.company_id"],
        filters: { id: ownerIds },
      })
      : { data: [] };
    const ownerCompany = new Map(owners.map((owner) => [owner.id, owner.employee?.company_id ?? null]));

    // The verified association compares the link with the owner's current employee record, two
    // values in different modules, so it cannot be a database filter.
    const carts = companyCarts.filter((cart) => hasVerifiedCartAssociation(
      { customer_id: cart.customer_id ?? null, company_id: companyId ?? null },
      cart.customer_id ? ownerCompany.get(cart.customer_id) ?? null : null,
    ));

    const { data: approvalStatuses, metadata } = carts.length
      ? await query.graph({
        entity: "approval_status",
        fields: ["*", "cart.approvals.id"],
        filters: {
          cart_id: carts.map((cart) => cart.id),
          ...(input.status ? { status: approvalStatusFilter(input.status) } : {}),
        },
        pagination: input.pagination,
      })
      : { data: [], metadata: undefined };
    const approvalIds = approvalStatuses
      .flatMap((approvalStatus) => approvalStatus.cart?.approvals ?? [])
      .flatMap((approval) => approval?.id ?? []);

    const { data: approvals } = approvalIds.length
      ? await query.graph({
        entity: "approval",
        fields: ["*"],
        filters: { id: approvalIds, type: ApprovalType.ADMIN },
      })
      : { data: [] };

    const cartsWithApprovals = carts.flatMap((cart) => {
      const cartApprovals = approvals.filter((approval) => approval.cart_id === cart.id);
      return cartApprovals.length ? [{ ...cart, approvals: cartApprovals }] : [];
    });
    return new StepResponse({
      carts_with_approvals: cartsWithApprovals,
      metadata: cartsWithApprovals.length ? metadata : { count: 0 },
    });
  },
);
