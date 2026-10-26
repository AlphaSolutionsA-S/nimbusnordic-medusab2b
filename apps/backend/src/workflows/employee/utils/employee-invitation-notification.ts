import {
  emailSubject,
  type EmailLocalization,
  type PreparedEmail,
} from "../../transactional-email/utils/email-notification";
import { resolveEmailTexts } from "../../transactional-email/utils/email-texts";
import { escapeHtml } from "../../transactional-email/utils/escape-html";
import { emailStorefrontOrigin } from "../../transactional-email/utils/storefront-origin";

export type InvitationRecipient = {
  email: string;
  first_name: string | null;
  company_name: string;
};

export const EMPLOYEE_INVITATION_EMAIL_SOURCE = "email:employee-invitation";

/** Built-in English copies of the decided text: the approved last fallback (NIMBUS-242). */
const SUBJECT = { "Emails.employeeInvitation.subject": "Your Nimbus Nordic customer portal account" };
const GREETING = { "Emails.employeeInvitation.greeting": "Hi {firstName}," };
const GREETING_WITHOUT_NAME = { "Emails.employeeInvitation.greetingWithoutName": "Hi," };
const BODY = {
  "Emails.employeeInvitation.body":
    "{companyName} has created an account for you on the Nimbus Nordic customer portal. You log in with this email address.",
  "Emails.employeeInvitation.passwordHint":
    'Your company administrator will give you your password. You can also choose your own password with "Forgot password" on the login page.',
  "Emails.employeeInvitation.loginLabel": "Log in to the customer portal",
};

/** A plain notification: no password, token or reset link, and one link, the login page. */
export function buildEmployeeInvitationNotification(
  recipient: InvitationRecipient,
  storeCors: string,
  localization: EmailLocalization
): PreparedEmail {
  const loginUrl = new URL(`/${localization.linkCountry}/account`, emailStorefrontOrigin(storeCors)).toString();
  const firstName = recipient.first_name?.trim();
  // Only the greeting that is sent is resolved, so a missing name never needs a placeholder value.
  const greetingKeys = firstName ? GREETING : GREETING_WITHOUT_NAME;
  const { texts, fallbacks } = resolveEmailTexts({
    keys: { ...SUBJECT, ...greetingKeys, ...BODY },
    locale: localization.locale,
    chosen: localization.chosen,
    english: localization.english,
    values: { companyName: recipient.company_name, ...(firstName ? { firstName } : {}) },
    source: EMPLOYEE_INVITATION_EMAIL_SOURCE,
  });
  const text = (key: string) => escapeHtml(texts[key]);
  const greeting = text(Object.keys(greetingKeys)[0]);
  return {
    notification: {
      to: recipient.email,
      channel: "email",
      template: "employee-invitation",
      content: {
        subject: emailSubject(texts["Emails.employeeInvitation.subject"]),
        html:
          `<p>${greeting}</p>` +
          `<p>${text("Emails.employeeInvitation.body")}</p>` +
          `<p>${text("Emails.employeeInvitation.passwordHint")}</p>` +
          `<p><a href="${escapeHtml(loginUrl)}">${text("Emails.employeeInvitation.loginLabel")}</a></p>`,
      },
      data: { login_url: loginUrl, locale: localization.locale },
    },
    fallbacks,
  };
}
