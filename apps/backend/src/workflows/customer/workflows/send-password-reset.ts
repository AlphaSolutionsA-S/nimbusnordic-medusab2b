import { sendNotificationsStep } from '@medusajs/medusa/core-flows';
import { createWorkflow, transform, when, WorkflowResponse } from '@medusajs/framework/workflows-sdk';
import { listConfiguredCountryCodesStep } from '../../storefront-translation/steps/list-configured-country-codes';
import { localizeEmailStep } from '../../transactional-email/steps/localize-email';
import { reportEmailFallbacksStep } from '../../transactional-email/steps/report-email-fallbacks';
import { preparePasswordResetNotificationStep } from '../steps/prepare-password-reset-notification';
import type { PasswordResetEvent } from '../utils/password-reset-notification';

export const sendCustomerPasswordResetWorkflow = createWorkflow(
  'send-customer-password-reset',
  (input: PasswordResetEvent) => {
    const notifications = when('send-reset-to-customer', input, (data) => data.actor_type === 'customer').then(() => {
      const configuredCountries = listConfiguredCountryCodesStep();
      const localization = localizeEmailStep(
        transform({ input, configuredCountries }, ({ input, configuredCountries }) => ({
          requestCountry: input.metadata?.country_code,
          configuredCountries,
        })),
      );
      const prepared = preparePasswordResetNotificationStep({ event: input, localization });
      const sent = sendNotificationsStep(transform({ prepared }, ({ prepared }) => [prepared.notification]));
      reportEmailFallbacksStep(transform({ prepared }, ({ prepared }) => prepared.fallbacks));
      return sent;
    });
    const result = transform({ notifications }, ({ notifications }) => notifications ?? []);
    return new WorkflowResponse(result);
  },
);
