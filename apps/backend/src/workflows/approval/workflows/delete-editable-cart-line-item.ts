import {
  acquireLockStep,
  deleteLineItemsStep,
  emitEventStep,
  refreshCartItemsWorkflow,
  releaseLockStep,
} from '@medusajs/core-flows';
import { CartWorkflowEvents } from '@medusajs/framework/utils';
import { createWorkflow, transform } from '@medusajs/framework/workflows-sdk';
import { validateCartEditStep } from '../steps/validate-cart-edit';

export const deleteEditableCartLineItemWorkflow = createWorkflow(
  'delete-editable-cart-line-item',
  function (input: { cart_id: string; line_id: string }) {
    acquireLockStep({ key: input.cart_id, timeout: 2, ttl: 30 });
    const cartId = validateCartEditStep(input);
    const lineIds = transform({ input, cartId }, ({ input }) => [input.line_id]);
    deleteLineItemsStep(lineIds);
    refreshCartItemsWorkflow.runAsStep({ input: { cart_id: cartId } });
    emitEventStep({ eventName: CartWorkflowEvents.UPDATED, data: { id: cartId } });
    releaseLockStep({ key: cartId });
  },
);
