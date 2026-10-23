import { buildPasswordResetNotification } from '../password-reset-notification';

const event = { entity_id: 'customer@example.test', actor_type: 'customer', token: 'proof&value', metadata: { country_code: 'se' } };

describe('password recovery notification', () => {
  it('uses email and a trusted country-prefixed destination with English instructions', () => {
    const notification = buildPasswordResetNotification(event, 'https://shop.example.test,https://other.example.test');
    expect(notification.channel).toBe('email');
    expect(notification.to).toBe(event.entity_id);
    const url = new URL(String(notification.data?.reset_url));
    expect(url.origin).toBe('https://shop.example.test');
    expect(url.pathname).toBe('/se/reset-password');
    expect(url.searchParams.get('token')).toBe(event.token);
    expect(notification.content?.subject).toBe('Reset your Nimbus Nordic password');
    expect(notification.content?.html).toContain('15 minutes');
    expect(notification.content?.html).not.toContain(event.entity_id);
  });

  it('ignores request-supplied destinations and unsafe country metadata', () => {
    const notification = buildPasswordResetNotification({ ...event, metadata: { country_code: '../evil', redirect_url: 'https://evil.test' } }, 'https://shop.example.test');
    expect(new URL(String(notification.data?.reset_url)).pathname).toBe('/dk/reset-password');
    expect(notification.content?.html).not.toContain('evil.test');
  });

  it.each(['', 'https://user:password@shop.example.test', 'http://shop.example.test', 'invalid'])('refuses unusable destination configuration %s', (origin) => {
    expect(() => buildPasswordResetNotification(event, origin)).toThrow();
  });

  it('allows the existing local HTTP storefront for development', () => {
    expect(buildPasswordResetNotification(event, 'http://localhost:8000').data?.reset_url).toContain('http://localhost:8000/se/reset-password');
  });
});
