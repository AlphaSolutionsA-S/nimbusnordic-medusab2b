import type { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa';
import { AuthWorkflowEvents } from '@medusajs/framework/utils';
import { sendCustomerPasswordResetWorkflow } from '../workflows/customer/workflows/send-password-reset';
import type { PasswordResetEvent } from '../workflows/customer/utils/password-reset-notification';

export default async function customerPasswordResetHandler({
  event: { data }, container,
}: SubscriberArgs<PasswordResetEvent>): Promise<void> {
  await sendCustomerPasswordResetWorkflow(container).run({ input: data });
}

export const config: SubscriberConfig = { event: AuthWorkflowEvents.PASSWORD_RESET };
