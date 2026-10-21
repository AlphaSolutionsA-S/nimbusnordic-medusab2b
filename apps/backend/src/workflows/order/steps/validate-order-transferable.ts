import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { createStep } from "@medusajs/framework/workflows-sdk";
import { canRequestOrderTransfer } from "../utils/order-transfer";

export const validateOrderTransferableStep = createStep(
  "validate-order-transferable",
  async (input: { order_id: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    // Deliberate exemption from data-core-read-workflows: only the owner fact is needed, before
    // core's request-transfer workflow reads the order itself.
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: ["id", "customer_id"],
      filters: { id: input.order_id, is_draft_order: false },
    });
    if (!order) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found");
    }
    const { data: [owner] } = order.customer_id
      ? await query.graph({
        entity: "customer",
        fields: ["id", "has_account"],
        filters: { id: order.customer_id },
      })
      : { data: [] };

    // No IDs in the message: core's own-order error names the customer.
    if (!canRequestOrderTransfer(owner ? { has_account: owner.has_account } : null)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Order cannot be transferred");
    }
  },
);
