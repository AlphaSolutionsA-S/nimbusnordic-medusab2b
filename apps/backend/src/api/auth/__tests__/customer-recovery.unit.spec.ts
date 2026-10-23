import { CustomerPasswordRecoveryRequest, CustomerPasswordRecoveryUpdate } from '../middlewares';

describe('customer recovery validation', () => {
  it.each([
    { password: 'short', password_confirmation: 'short' },
    { password: 'long-password', password_confirmation: 'different' },
    { password: 'long-password' },
  ])('refuses invalid new credentials without echoing them', (body) => {
    const result = CustomerPasswordRecoveryUpdate.safeParse(body);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).not.toContain(body.password);
    }
  });

  it('accepts matching passwords of at least eight characters', () => {
    expect(CustomerPasswordRecoveryUpdate.parse({
      password: '12345678', password_confirmation: '12345678',
    })).toEqual({ password: '12345678', password_confirmation: '12345678' });
  });

  it.each(['https://evil.test', '../dk', 'dk/reset', 'DK', 'd'])('rejects unsafe country %s', (country_code) => {
    expect(CustomerPasswordRecoveryRequest.safeParse({
      identifier: 'customer@example.test', metadata: { country_code },
    }).success).toBe(false);
  });

  it('validates email and accepts a country without a redirect destination', () => {
    expect(CustomerPasswordRecoveryRequest.safeParse({ identifier: 'invalid' }).success).toBe(false);
    expect(CustomerPasswordRecoveryRequest.parse({
      identifier: 'customer@example.test', metadata: { country_code: 'dk', redirect_url: 'https://evil.test' },
    })).toEqual({ identifier: 'customer@example.test', metadata: { country_code: 'dk' } });
  });
});
