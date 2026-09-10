import { afterEach, describe, expect, it } from 'vitest';

import { getClaimsPreviewURL, getPayloadOrigin, getStorefrontOrigin } from './live-preview';

const originalEnv = process.env;

afterEach(() => {
  process.env = originalEnv;
});

describe('Payload live preview configuration', () => {
  it('uses the local storefront defaults', () => {
    process.env = { ...originalEnv };
    delete process.env.STOREFRONT_URL;
    delete process.env.STOREFRONT_DEFAULT_COUNTRY;

    expect(getClaimsPreviewURL()).toBe(
      'http://localhost:8000/us/account/claims?livePreview=true',
    );
  });

  it('builds a preview URL for the configured storefront', () => {
    process.env = {
      ...originalEnv,
      STOREFRONT_DEFAULT_COUNTRY: 'dk',
      STOREFRONT_URL: 'https://portal.example.com/',
    };

    expect(getClaimsPreviewURL()).toBe(
      'https://portal.example.com/dk/account/claims?livePreview=true',
    );
    expect(getStorefrontOrigin()).toBe('https://portal.example.com');
  });

  it('uses the configured CMS origin for admin CSRF requests', () => {
    process.env = {
      ...originalEnv,
      PAYLOAD_PUBLIC_URL: 'https://cms.example.com/admin',
    };

    expect(getPayloadOrigin()).toBe('https://cms.example.com');
  });

  it('uses the Azure hostname when the CMS URL is not configured', () => {
    process.env = {
      ...originalEnv,
      WEBSITE_HOSTNAME: 'cms.azurewebsites.net',
    };
    delete process.env.PAYLOAD_PUBLIC_URL;

    expect(getPayloadOrigin()).toBe('https://cms.azurewebsites.net');
  });

  it('rejects unsafe URL protocols', () => {
    process.env = {
      ...originalEnv,
      STOREFRONT_URL: 'javascript:alert(1)',
    };

    expect(() => getClaimsPreviewURL()).toThrow('must use HTTP or HTTPS');
  });

  it('rejects invalid country codes', () => {
    process.env = {
      ...originalEnv,
      STOREFRONT_DEFAULT_COUNTRY: '../admin',
    };

    expect(() => getClaimsPreviewURL()).toThrow('lowercase ISO-2 country code');
  });
});
