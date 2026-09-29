import {
  addShippingMethodToCartWorkflow,
  transferCartCustomerWorkflow,
  updateCartPromotionsWorkflow,
  updateLineItemInCartWorkflow,
} from '@medusajs/core-flows';
import type { MedusaContainer } from '@medusajs/framework/types';
import { StepResponse } from '@medusajs/framework/workflows-sdk';
import { validateCartEditWorkflow } from '../approval/workflows/validate-cart-edit';

async function validateMutation(
  { cart }: { cart: { id: string } },
  { container }: { container: MedusaContainer },
): Promise<StepResponse<undefined>> {
  await validateCartEditWorkflow(container).run({ input: { cart_id: cart.id } });
  return new StepResponse(undefined);
}

addShippingMethodToCartWorkflow.hooks.validate(validateMutation);
transferCartCustomerWorkflow.hooks.validate(validateMutation);
updateCartPromotionsWorkflow.hooks.validate(validateMutation);
updateLineItemInCartWorkflow.hooks.validate(validateMutation);
