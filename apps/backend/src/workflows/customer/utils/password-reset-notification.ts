import type { SendNotificationsStepInput } from '@medusajs/medusa/core-flows';
import type { MessageDocument, MissingReport } from '../../../types/storefront-translation';
import { resolveEmailTexts } from '../../transactional-email/utils/email-texts';
import { escapeHtml } from '../../transactional-email/utils/escape-html';
import { emailStorefrontOrigin } from '../../transactional-email/utils/storefront-origin';

export type PasswordResetEvent = {
  entity_id: string;
  actor_type: string;
  token: string;
  metadata?: Record<string, unknown>;
};

export type PasswordResetLocalization = {
  locale: string;
  linkCountry: string;
  chosen: MessageDocument | null;
  english: MessageDocument | null;
};

export type PasswordResetNotification = {
  notification: SendNotificationsStepInput[number];
  fallbacks: MissingReport[];
};

export const PASSWORD_RESET_EMAIL_SOURCE = 'email:customer-password-reset';

/** Built-in English copies: the approved last fallback when the English keys are unusable (NIMBUS-162). */
const PASSWORD_RESET_TEXTS = {
  'Emails.passwordReset.subject': 'Reset your Nimbus Nordic password',
  'Emails.passwordReset.intro': 'We received a request to reset your Nimbus Nordic password.',
  'Emails.passwordReset.linkLabel': 'Choose a new password',
  'Emails.passwordReset.expiry': 'This link expires in 15 minutes. If you did not request a password reset, you can ignore this email.',
};

export function buildPasswordResetNotification(
  event: PasswordResetEvent,
  storeCors: string,
  localization: PasswordResetLocalization,
): PasswordResetNotification {
  const url = new URL(`/${localization.linkCountry}/reset-password`, emailStorefrontOrigin(storeCors));
  url.searchParams.set('token', event.token);
  const resetUrl = url.toString();
  const { texts, fallbacks } = resolveEmailTexts({
    keys: PASSWORD_RESET_TEXTS,
    locale: localization.locale,
    chosen: localization.chosen,
    english: localization.english,
    values: {},
    source: PASSWORD_RESET_EMAIL_SOURCE,
  });
  const text = (key: keyof typeof PASSWORD_RESET_TEXTS) => escapeHtml(texts[key]);
  return {
    notification: {
      to: event.entity_id,
      channel: 'email',
      template: 'customer-password-reset',
      content: {
        // A header, not HTML: only line breaks are a risk, so all whitespace collapses to one space.
        subject: texts['Emails.passwordReset.subject'].replace(/\s+/g, ' ').trim(),
        html: `<p>${text('Emails.passwordReset.intro')}</p><p><a href="${escapeHtml(resetUrl)}">${text('Emails.passwordReset.linkLabel')}</a></p><p>${text('Emails.passwordReset.expiry')}</p>`,
      },
      data: { reset_url: resetUrl, locale: localization.locale },
    },
    fallbacks,
  };
}
