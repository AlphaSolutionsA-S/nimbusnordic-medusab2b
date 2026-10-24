import type { MessageDocument } from '../../../../types/storefront-translation';
import type { EmailLocalization } from '../../../transactional-email/utils/email-notification';
import {
  buildEmployeeInvitationNotification,
  EMPLOYEE_INVITATION_EMAIL_SOURCE,
  type InvitationRecipient,
} from '../employee-invitation-notification';

const recipient: InvitationRecipient = {
  email: 'new.employee@example.test',
  first_name: 'Anna',
  company_name: 'Acme ApS',
};
const english: EmailLocalization = { locale: 'en', linkCountry: 'dk', chosen: null, english: null };
const danish: MessageDocument = {
  Emails: {
    employeeInvitation: {
      subject: 'Din konto på Nimbus Nordic-kundeportalen',
      greeting: 'Hej {firstName},',
      greetingWithoutName: 'Hej,',
      body: '{companyName} har oprettet en konto til dig.',
      passwordHint: 'Din administrator giver dig din adgangskode.',
      loginLabel: 'Log ind på kundeportalen',
    },
  },
};

const DECIDED_HTML =
  '<p>Hi Anna,</p>' +
  '<p>Acme ApS has created an account for you on the Nimbus Nordic customer portal. You log in with this email address.</p>' +
  '<p>Your company administrator will give you your password. You can also choose your own password with &quot;Forgot password&quot; on the login page.</p>' +
  '<p><a href="https://shop.example.test/dk/account">Log in to the customer portal</a></p>';

function build(
  localization: EmailLocalization = english,
  to: InvitationRecipient = recipient,
  storeCors = 'https://shop.example.test,https://other.example.test',
) {
  return buildEmployeeInvitationNotification(to, storeCors, localization);
}

describe('employee invitation notification', () => {
  it('sends the decided English text to the invited address with a login link and the locale', () => {
    const { notification, fallbacks } = build();
    expect(notification).toEqual({
      to: 'new.employee@example.test',
      channel: 'email',
      template: 'employee-invitation',
      content: { subject: 'Your Nimbus Nordic customer portal account', html: DECIDED_HTML },
      data: { login_url: 'https://shop.example.test/dk/account', locale: 'en' },
    });
    expect(fallbacks).toEqual([]);
  });

  it('builds the login link from the first STORE_CORS origin and the link country', () => {
    const { notification } = build({ ...english, linkCountry: 'se' });
    const url = new URL(String(notification.data?.login_url));
    expect(url.origin).toBe('https://shop.example.test');
    expect(url.pathname).toBe('/se/account');
    expect(url.search).toBe('');
  });

  it('carries no password, token or reset link in the HTML or the data', () => {
    const { notification } = build({ locale: 'da', linkCountry: 'dk', chosen: danish, english: null });
    const rendered = `${notification.content?.html} ${JSON.stringify(notification.data)}`;
    expect(rendered).not.toMatch(/token|reset-password/i);
    expect(JSON.stringify(notification.data)).not.toMatch(/password/i);
    expect(Object.keys(notification.data ?? {}).sort()).toEqual(['locale', 'login_url']);
  });

  it('has exactly one link, the login page', () => {
    const html = String(build().notification.content?.html);
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html.match(/href=/g)).toHaveLength(1);
  });

  it('uses the chosen language texts with the names filled in', () => {
    const { notification, fallbacks } = build({ locale: 'da', linkCountry: 'dk', chosen: danish, english: null });
    expect(notification.content?.subject).toBe('Din konto på Nimbus Nordic-kundeportalen');
    expect(notification.content?.html).toContain('<p>Hej Anna,</p>');
    expect(notification.content?.html).toContain('Acme ApS har oprettet en konto til dig.');
    expect(notification.data?.locale).toBe('da');
    expect(fallbacks).toEqual([]);
  });

  it.each([null, '', '   '])('greets without a name when the first name is %p', (firstName) => {
    const { notification, fallbacks } = build(english, { ...recipient, first_name: firstName });
    expect(notification.content?.html).toMatch(/^<p>Hi,<\/p>/);
    expect(notification.content?.html).not.toContain('{firstName}');
    expect(fallbacks).toEqual([]);
  });

  it('uses the translated greeting without a name', () => {
    const { notification } = build({ locale: 'da', linkCountry: 'dk', chosen: danish, english: null }, { ...recipient, first_name: null });
    expect(notification.content?.html).toMatch(/^<p>Hej,<\/p>/);
  });

  it('escapes names, company and texts so they cannot add markup or links', () => {
    const hostile: InvitationRecipient = {
      email: 'new.employee@example.test',
      first_name: '<script>alert(1)</script>',
      company_name: 'Evil "Co" & <a href="https://evil.test">x</a>',
    };
    const chosen = { Emails: { employeeInvitation: { loginLabel: '"><a href="https://evil.test">x' } } };
    const html = String(build({ locale: 'da', linkCountry: 'dk', chosen, english: null }, hostile).notification.content?.html);
    expect(html).toContain('Hi &lt;script&gt;alert(1)&lt;/script&gt;,');
    expect(html).toContain('Evil &quot;Co&quot; &amp; &lt;a href=&quot;https://evil.test&quot;&gt;x&lt;/a&gt;');
    expect(html).toContain('&quot;&gt;&lt;a href=&quot;https://evil.test&quot;&gt;x');
    expect(html).not.toContain('<script>');
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('<a href="https://shop.example.test/dk/account">');
  });

  it('collapses line breaks in the subject so a text cannot add mail headers', () => {
    const chosen = { Emails: { employeeInvitation: { subject: 'Konto\r\nBcc: evil@example.test\n  her' } } };
    const { notification } = build({ locale: 'da', linkCountry: 'dk', chosen, english: null });
    expect(notification.content?.subject).toBe('Konto Bcc: evil@example.test her');
  });

  it('reports missing texts under the email source without personal data', () => {
    const partial = { Emails: { employeeInvitation: { subject: 'Din konto' } } };
    const { notification, fallbacks } = build({ locale: 'da', linkCountry: 'dk', chosen: partial, english: { Emails: {} } });
    expect(notification.content?.html).toContain('Log in to the customer portal');
    expect(fallbacks).toContainEqual({ kind: 'key', locale: 'da', key: 'Emails.employeeInvitation.loginLabel', page_path: EMPLOYEE_INVITATION_EMAIL_SOURCE });
    expect(fallbacks).toContainEqual({ kind: 'key', locale: 'en', key: 'Emails.employeeInvitation.loginLabel', page_path: 'email:employee-invitation' });
    expect(fallbacks.map((report) => (report.kind === 'key' ? report.key : null))).not.toContain('Emails.employeeInvitation.greetingWithoutName');
    expect(JSON.stringify(fallbacks)).not.toMatch(/new\.employee|Anna|Acme/);
  });

  it('falls back without a report when a text uses an unknown placeholder', () => {
    const chosen = { Emails: { employeeInvitation: { ...(danish.Emails as MessageDocument).employeeInvitation as MessageDocument, body: 'Your password is {password}' } } };
    const { notification, fallbacks } = build({ locale: 'da', linkCountry: 'dk', chosen, english: null });
    expect(notification.content?.html).toContain('Acme ApS has created an account for you');
    expect(notification.content?.html).not.toContain('{password}');
    expect(fallbacks).toEqual([]);
  });

  it('refuses unusable destination configuration', () => {
    expect(() => build(english, recipient, 'http://shop.example.test')).toThrow('Email storefront configuration is invalid');
  });
});
