import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk';
import { validateCartEditStep } from '../steps/validate-cart-edit';

export const validateCartEditWorkflow = createWorkflow(
  'validate-cart-edit',
  function (input: { cart_id: string }) {
    return new WorkflowResponse(validateCartEditStep(input));
  },
);
