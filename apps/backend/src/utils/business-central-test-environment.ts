const BUSINESS_CENTRAL_API_HOST = "api.businesscentral.dynamics.com";
const DEFAULT_BUSINESS_CENTRAL_TEST_ENVIRONMENTS = "TestDK,TestNO";

/**
 * Extracts the environment segment from a Business Central discovery URL of the form
 * https://api.businesscentral.dynamics.com/v2.0/<tenant>/<environment>/api/v2.0.
 * Returns null when the URL is missing or does not have that shape.
 */
export function parseBusinessCentralEnvironment(
  discoveryUrl: string | undefined
): string | null {
  if (!discoveryUrl) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(discoveryUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.hostname !== BUSINESS_CENTRAL_API_HOST) {
    return null;
  }

  const [apiVersion, tenant, environment] = url.pathname.split("/").filter(Boolean);

  if (apiVersion !== "v2.0" || !tenant || !environment) {
    return null;
  }

  return environment;
}

/**
 * Comma-separated allowlist from BUSINESS_CENTRAL_TEST_ENVIRONMENTS. A blank or unset value falls
 * back to the default, the same pattern as BUSINESS_CENTRAL_LCY_CODE.
 */
export function parseAllowedBusinessCentralTestEnvironments(
  value: string | undefined
): string[] {
  const configured = value?.trim() ? value : DEFAULT_BUSINESS_CENTRAL_TEST_ENVIRONMENTS;

  return configured
    .split(",")
    .map((environment) => environment.trim())
    .filter(Boolean);
}

function assertAllowedEnvironment(
  env: Readonly<Record<string, string | undefined>>,
  variable: string,
  allowed: readonly string[]
): string {
  const environment = parseBusinessCentralEnvironment(env[variable]);

  if (!environment) {
    throw new Error(
      `Refusing to run integration tests: ${variable} is missing or is not a valid Business Central discovery URL`
    );
  }

  if (!allowed.includes(environment)) {
    throw new Error(
      `Refusing to run integration tests against Business Central environment '${environment}' — not an allowed test environment`
    );
  }

  return environment;
}

/**
 * Fails closed unless BUSINESS_CENTRAL_DISCOVERY_URL targets an allowed test environment, and,
 * when set, BUSINESS_CENTRAL_NO_DISCOVERY_URL too. Returns the Danish environment. The error
 * messages contain only the environment name — never the URL, tenant id, client id or secret.
 */
export function assertBusinessCentralTestEnvironment(
  env: Readonly<Record<string, string | undefined>>
): string {
  const allowed = parseAllowedBusinessCentralTestEnvironments(
    env.BUSINESS_CENTRAL_TEST_ENVIRONMENTS
  );
  const environment = assertAllowedEnvironment(env, "BUSINESS_CENTRAL_DISCOVERY_URL", allowed);

  if (env.BUSINESS_CENTRAL_NO_DISCOVERY_URL?.trim()) {
    assertAllowedEnvironment(env, "BUSINESS_CENTRAL_NO_DISCOVERY_URL", allowed);
  }

  return environment;
}
