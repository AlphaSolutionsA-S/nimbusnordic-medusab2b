import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import { ApprovalStatusType } from '../../../types/approval';

export const validateCartEditStep = createStep(
  'validate-cart-edit',
  async (input: { cart_id: string; line_id?: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: [cart] } = await query.graph({
      entity: 'cart',
      fields: ['id', 'approvals.status', ...(input.line_id ? ['items.id'] : [])],
      filters: { id: input.cart_id },
    }, { throwIfKeyNotFound: true });
    if (cart.approvals?.some((approval) => approval &&
      (approval.status === ApprovalStatusType.PENDING ||
        approval.status === ApprovalStatusType.APPROVED))) {
      throw new MedusaError(
        MedusaError.Types.FORBIDDEN,
        'A cart awaiting approval or already approved cannot be changed. Create a new cart.',
      );
    }
    if (input.line_id && !cart.items?.some((item) => item?.id === input.line_id)) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Line item not found in cart');
    }
    return new StepResponse(input.cart_id);
  },
);
