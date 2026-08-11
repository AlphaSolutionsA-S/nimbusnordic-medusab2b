import type { ResendAdapterArgs } from '@payloadcms/email-resend';

const RESEND_ENVIRONMENT_VARIABLES = [
  'RESEND_API_KEY',
  'RESEND_FROM_ADDRESS',
  'RESEND_FROM_NAME',
] as const;

type ResendEnvironment = Readonly<Record<string, string | undefined>>;

export function getResendAdapterArgs(
  environment: ResendEnvironment = process.env,
): ResendAdapterArgs | undefined {
  const configuredValues = RESEND_ENVIRONMENT_VARIABLES.filter(
    (name) => environment[name]?.trim(),
  );

  if (configuredValues.length === 0) {
    return undefined;
  }

  const missingValues = RESEND_ENVIRONMENT_VARIABLES.filter(
    (name) => !environment[name]?.trim(),
  );

  if (missingValues.length > 0) {
    throw new Error(
      `Missing required Resend email environment variables: ${missingValues.join(', ')}`,
    );
  }

  return {
    apiKey: environment.RESEND_API_KEY?.trim() || '',
    defaultFromAddress: environment.RESEND_FROM_ADDRESS?.trim() || '',
    defaultFromName: environment.RESEND_FROM_NAME?.trim() || '',
  };
}
