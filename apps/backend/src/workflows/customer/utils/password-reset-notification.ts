import type { SendNotificationsStepInput } from '@medusajs/medusa/core-flows';
import { MedusaError } from '@medusajs/framework/utils';

export type PasswordResetEvent = {
  entity_id: string;
  actor_type: string;
  token: string;
  metadata?: Record<string, unknown>;
};

export function buildPasswordResetNotification(
  event: PasswordResetEvent,
  storeCors: string,
): SendNotificationsStepInput[number] {
  // STORE_CORS is deployment-owned; request origins and redirect URLs never choose the destination.
  const storefront = new URL(storeCors.split(',')[0].trim());
  if (storefront.username || storefront.password ||
      (storefront.protocol !== 'https:' &&
       !(storefront.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(storefront.hostname)))) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Password recovery storefront configuration is invalid');
  }
  const requestedCountry = event.metadata?.country_code;
  const country = typeof requestedCountry === 'string' && /^[a-z]{2}$/.test(requestedCountry) ? requestedCountry : 'dk';
  const url = new URL(`/${country}/reset-password`, storefront.origin);
  url.searchParams.set('token', event.token);
  const resetUrl = url.toString();
  const safeUrl = resetUrl.replace(/&/g, '&amp;');
  return {
    to: event.entity_id,
    channel: 'email',
    template: 'customer-password-reset',
    content: {
      subject: 'Reset your Nimbus Nordic password',
      html: `<p>We received a request to reset your Nimbus Nordic password.</p><p><a href="${safeUrl}">Choose a new password</a></p><p>This link expires in 15 minutes. If you did not request a password reset, you can ignore this email.</p>`,
    },
    data: { reset_url: resetUrl },
  };
}
