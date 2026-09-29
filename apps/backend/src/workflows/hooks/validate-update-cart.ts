import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { StepResponse } from "@medusajs/framework/workflows-sdk";
import { updateCartWorkflow } from "@medusajs/medusa/core-flows";
import { getCartApprovalStatus } from "../../utils/get-cart-approval-status";

updateCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const {
    data: [queryCart],
  } = await query.graph({
    entity: "cart",
    fields: ["approvals.*"],
    filters: {
      id: cart.id,
    },
  });

  const { isPendingApproval, isApproved } = getCartApprovalStatus(queryCart);

  if (isPendingApproval || isApproved) {
    throw new Error("Cart awaiting approval or already approved cannot be changed");
  }

  return new StepResponse(undefined, null);
});
