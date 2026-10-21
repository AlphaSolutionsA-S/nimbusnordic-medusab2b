import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { canAccessCart, type CartOperation } from "../utils/cart-access";

export interface CartAccessInput {
  customer_id: string;
  operation: CartOperation;
  /** Exactly one of `cart_id` and `payment_collection_id`. */
  cart_id?: string;
  payment_collection_id?: string;
}

// Refusal and absence share one error so the response cannot reveal that a cart exists.
function cartNotFound(): MedusaError {
  return new MedusaError(MedusaError.Types.NOT_FOUND, "Cart not found");
}

export const validateCartAccessStep = createStep(
  "validate-cart-access",
  async (input: CartAccessInput, { container }) => {
    if (!input.cart_id === !input.payment_collection_id) {
      throw cartNotFound();
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    let cartId = input.cart_id;
    if (!cartId) {
      const { data: [link] } = await query.graph({
        entity: "cart_payment_collection",
        fields: ["cart_id"],
        filters: { payment_collection_id: input.payment_collection_id },
      });
      cartId = link?.cart_id;
      if (!cartId) {
        throw cartNotFound();
      }
    }

    // Deliberate exemption from data-core-read-workflows: core-flows has no cart read workflow,
    // and this is a narrow ownership and scope check read fresh on every request.
    const { data: [cart] } = await query.graph({
      entity: "cart",
      fields: [
        "id", "customer_id", "company.id", "approvals.type", "approvals.status",
        "customer.employee.company_id",
      ],
      filters: { id: cartId },
    });
    if (!cart) {
      throw cartNotFound();
    }
    const { data: [caller] } = await query.graph({
      entity: "customer",
      fields: ["id", "employee.company_id", "employee.is_admin"],
      filters: { id: input.customer_id },
    });

    const allowed = canAccessCart(input.operation, {
      caller: {
        id: input.customer_id,
        employee: caller?.employee
          ? { company_id: caller.employee.company_id, is_admin: caller.employee.is_admin }
          : null,
      },
      cart: {
        customer_id: cart.customer_id ?? null,
        company_id: cart.company?.id ?? null,
        approvals: (cart.approvals ?? []).filter((approval) => approval !== null),
      },
      owner_company_id: cart.customer?.employee?.company_id ?? null,
    });
    if (!allowed) {
      throw cartNotFound();
    }
    return new StepResponse(cart.id);
  },
);
