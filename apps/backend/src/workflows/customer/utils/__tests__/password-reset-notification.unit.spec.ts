import { chooseEmailLanguage } from '../../../transactional-email/utils/email-language';
import type { EmailLocalization } from '../../../transactional-email/utils/email-notification';
import { buildPasswordResetNotification, PASSWORD_RESET_EMAIL_SOURCE } from '../password-reset-notification';

const event = { entity_id: 'customer@example.test', actor_type: 'customer', token: 'proof&value', metadata: { country_code: 'se' } };
const english: EmailLocalization = { locale: 'en', linkCountry: 'se', chosen: null, english: null };
const danishTexts = {
  Emails: {
    passwordReset: {
      subject: 'Nulstil din adgangskode',
      intro: 'Vi har modtaget en anmodning om at nulstille din adgangskode.',
      linkLabel: 'Vælg en ny adgangskode',
      expiry: 'Linket udløber om 15 minutter.',
    },
  },
};

const TODAY_HTML = '<p>We received a request to reset your Nimbus Nordic password.</p><p><a href="https://shop.example.test/se/reset-password?token=proof%26value">Choose a new password</a></p><p>This link expires in 15 minutes. If you did not request a password reset, you can ignore this email.</p>';

function build(localization: EmailLocalization = english, storeCors = 'https://shop.example.test,https://other.example.test', input = event) {
  return buildPasswordResetNotification(input, storeCors, localization);
}

describe('password recovery notification', () => {
  it('keeps today\'s English wording, recipient and data when only built-in copies are available', () => {
    const { notification } = build();
    expect(notification.channel).toBe('email');
    expect(notification.to).toBe(event.entity_id);
    expect(notification.template).toBe('customer-password-reset');
    expect(notification.content?.subject).toBe('Reset your Nimbus Nordic password');
    expect(notification.content?.html).toBe(TODAY_HTML);
    expect(notification.data).toEqual({ reset_url: 'https://shop.example.test/se/reset-password?token=proof%26value', locale: 'en' });
    expect(notification.content?.html).not.toContain(event.entity_id);
  });

  it('builds the link from the first STORE_CORS origin, the link country and the token', () => {
    const url = new URL(String(build().notification.data?.reset_url));
    expect(url.origin).toBe('https://shop.example.test');
    expect(url.pathname).toBe('/se/reset-password');
    expect(url.searchParams.get('token')).toBe(event.token);
  });

  it('uses the chosen language texts and records the locale', () => {
    const { notification, fallbacks } = build({ locale: 'da', linkCountry: 'dk', chosen: danishTexts, english: null });
    expect(notification.content?.subject).toBe('Nulstil din adgangskode');
    expect(notification.content?.html).toContain('Vælg en ny adgangskode');
    expect(notification.content?.html).toContain('Linket udløber om 15 minutter.');
    expect(notification.data?.locale).toBe('da');
    expect(new URL(String(notification.data?.reset_url)).pathname).toBe('/dk/reset-password');
    expect(fallbacks).toEqual([]);
  });

  it('reports each missing text under the email source and falls back per text', () => {
    const partial = { Emails: { passwordReset: { subject: 'Nulstil din adgangskode' } } };
    const { notification, fallbacks } = build({ locale: 'da', linkCountry: 'dk', chosen: partial, english: { Emails: {} } });
    expect(notification.content?.subject).toBe('Nulstil din adgangskode');
    expect(notification.content?.html).toContain('Choose a new password');
    expect(fallbacks).toContainEqual({ kind: 'key', locale: 'da', key: 'Emails.passwordReset.linkLabel', page_path: PASSWORD_RESET_EMAIL_SOURCE });
    expect(fallbacks).toContainEqual({ kind: 'key', locale: 'en', key: 'Emails.passwordReset.linkLabel', page_path: 'email:customer-password-reset' });
    expect(JSON.stringify(fallbacks)).not.toMatch(/customer@example\.test|proof|reset-password/);
  });

  it('escapes every body text so a translated label cannot add markup or links', () => {
    const hostile = { Emails: { passwordReset: {
      subject: 'Subject',
      intro: '<script>alert(1)</script> & "quotes"',
      linkLabel: '"><a href="https://evil.test">x',
      expiry: "it's <b>bold</b>",
    } } };
    const { notification } = build({ locale: 'da', linkCountry: 'dk', chosen: hostile, english: null });
    const html = String(notification.content?.html);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;');
    expect(html).toContain('&quot;&gt;&lt;a href=&quot;https://evil.test&quot;&gt;x');
    expect(html).toContain('it&#39;s &lt;b&gt;bold&lt;/b&gt;');
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).not.toContain('<script>');
    expect(html).toContain('<a href="https://shop.example.test/dk/reset-password?token=proof%26value">');
  });

  it('collapses line breaks in the subject so a text cannot add mail headers', () => {
    const chosen = { Emails: { passwordReset: { subject: 'Nulstil\r\nBcc: evil@example.test\n  kode' } } };
    const { notification } = build({ locale: 'da', linkCountry: 'dk', chosen, english: null });
    expect(notification.content?.subject).toBe('Nulstil Bcc: evil@example.test kode');
    expect(notification.content?.subject).not.toMatch(/[\r\n]/);
  });

  it('ignores request-supplied destinations and unsafe country metadata', () => {
    const hostile = { ...event, metadata: { country_code: '../evil', redirect_url: 'https://evil.test' } };
    const language = chooseEmailLanguage({ requestCountry: hostile.metadata.country_code, configuredCountries: ['dk', 'se'], assignments: null });
    const { notification } = build({ ...language, chosen: null, english: null }, 'https://shop.example.test', hostile);
    expect(new URL(String(notification.data?.reset_url)).pathname).toBe('/dk/reset-password');
    expect(notification.data?.locale).toBe('en');
    expect(notification.content?.html).not.toContain('evil.test');
  });

  it('refuses unusable destination configuration', () => {
    expect(() => build(english, 'http://shop.example.test')).toThrow('Email storefront configuration is invalid');
  });
});
