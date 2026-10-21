import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { canAccessOrder, type OrderOperation } from "../utils/order-access";

export interface OrderAccessInput {
  customer_id: string;
  /** Both classes follow the same rule; kept so routes state what they guard. */
  operation: OrderOperation;
  order_id: string;
}

// Refusal and absence share one error so the response cannot reveal that an order exists.
function orderNotFound(): MedusaError {
  return new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found");
}

export const validateOrderAccessStep = createStep(
  "validate-order-access",
  async (input: OrderAccessInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    // Deliberate exemption from data-core-read-workflows: a narrow ownership and scope check read
    // fresh on every request; the guarded route itself reads through getOrderDetailWorkflow.
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: ["id", "customer_id"],
      filters: { id: input.order_id, is_draft_order: false },
    });
    if (!order) {
      throw orderNotFound();
    }
    const ownerId = order.customer_id ?? null;

    const { data: [link] } = await query.graph({
      entity: "order_cart",
      fields: ["cart_id"],
      filters: { order_id: order.id },
    });
    const { data: [cart] } = link?.cart_id
      ? await query.graph({
        entity: "cart",
        fields: ["id", "customer_id", "company.id", "approvals.type", "approvals.status"],
        filters: { id: link.cart_id },
      })
      : { data: [] };
    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id", "employee.company_id", "employee.is_admin"],
      filters: { id: ownerId ? [input.customer_id, ownerId] : [input.customer_id] },
    });
    const caller = customers.find((customer) => customer.id === input.customer_id);
    const owner = customers.find((customer) => customer.id === ownerId);

    const allowed = canAccessOrder({
      caller: {
        id: input.customer_id,
        employee: caller?.employee
          ? { company_id: caller.employee.company_id, is_admin: caller.employee.is_admin }
          : null,
      },
      order: { customer_id: ownerId },
      source_cart: cart
        ? {
          customer_id: cart.customer_id ?? null,
          company_id: cart.company?.id ?? null,
          approvals: (cart.approvals ?? []).filter((approval) => approval !== null),
        }
        : null,
      owner_company_id: owner?.employee?.company_id ?? null,
    });
    if (!allowed) {
      throw orderNotFound();
    }
    return new StepResponse(order.id);
  },
);
