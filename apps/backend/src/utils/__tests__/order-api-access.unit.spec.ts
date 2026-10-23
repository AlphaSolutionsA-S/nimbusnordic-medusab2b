import { isCompanyEnabledForOrderApi } from '../order-api-access';

describe('order API access', () => {
  it('enables a company whose setting is true', () => {
    expect(isCompanyEnabledForOrderApi({ order_api_enabled: true })).toBe(true);
  });

  it('does not enable a company whose setting is false', () => {
    expect(isCompanyEnabledForOrderApi({ order_api_enabled: false })).toBe(false);
  });

  it.each([null, undefined])('does not enable a company whose setting is %s', (value) => {
    expect(isCompanyEnabledForOrderApi({ order_api_enabled: value })).toBe(false);
  });

  it.each([null, undefined])('does not enable a missing company (%s)', (company) => {
    expect(isCompanyEnabledForOrderApi(company)).toBe(false);
  });
});
