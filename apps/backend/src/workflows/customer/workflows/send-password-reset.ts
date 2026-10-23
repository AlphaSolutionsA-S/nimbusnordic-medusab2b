import { sendNotificationsStep } from '@medusajs/medusa/core-flows';
import { createWorkflow, transform, when, WorkflowResponse } from '@medusajs/framework/workflows-sdk';
import { preparePasswordResetNotificationStep } from '../steps/prepare-password-reset-notification';
import type { PasswordResetEvent } from '../utils/password-reset-notification';

export const sendCustomerPasswordResetWorkflow = createWorkflow(
  'send-customer-password-reset',
  (input: PasswordResetEvent) => {
    const notifications = when(input, (data) => data.actor_type === 'customer').then(() => {
      const prepared = preparePasswordResetNotificationStep(input);
      return sendNotificationsStep(prepared);
    });
    const result = transform({ notifications }, ({ notifications }) => notifications ?? []);
    return new WorkflowResponse(result);
  },
);
