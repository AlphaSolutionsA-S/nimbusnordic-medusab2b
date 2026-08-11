import { describe, expect, it } from 'vitest';

import { getResendAdapterArgs } from './email';

describe('Resend email configuration', () => {
  it('leaves email disabled when no Resend settings are configured', () => {
    expect(getResendAdapterArgs({})).toBeUndefined();
  });

  it('returns the configured Resend adapter arguments', () => {
    expect(
      getResendAdapterArgs({
        RESEND_API_KEY: 're_test_key',
        RESEND_FROM_ADDRESS: 'noreply@example.com',
        RESEND_FROM_NAME: 'Nimbus Nordic CMS',
      }),
    ).toEqual({
      apiKey: 're_test_key',
      defaultFromAddress: 'noreply@example.com',
      defaultFromName: 'Nimbus Nordic CMS',
    });
  });

  it('rejects partial configuration without exposing configured values', () => {
    expect(() =>
      getResendAdapterArgs({
        RESEND_API_KEY: 'secret-key-that-must-not-be-logged',
      }),
    ).toThrow(
      'Missing required Resend email environment variables: RESEND_FROM_ADDRESS, RESEND_FROM_NAME',
    );
  });
});
