import { MedusaError } from "@medusajs/framework/utils";

import type { BusinessCentralEnvironment } from "./types";

const BUSINESS_CENTRAL_API_HOST = "api.businesscentral.dynamics.com";
const AZURE_GUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

type EnvironmentSettings = {
  discoveryUrlVariable: string;
  companyIdVariable: string;
  localCurrencyVariable: string;
  // NO has no default URL, so a missing setting fails NO calls instead of reaching another
  // environment.
  defaultDiscoveryUrl?: string;
  defaultLocalCurrency: string;
};

const SETTINGS: Record<BusinessCentralEnvironment, EnvironmentSettings> = {
  DK: {
    discoveryUrlVariable: "BUSINESS_CENTRAL_DISCOVERY_URL",
    companyIdVariable: "BUSINESS_CENTRAL_COMPANY_ID",
    localCurrencyVariable: "BUSINESS_CENTRAL_LCY_CODE",
    defaultDiscoveryUrl:
      "https://api.businesscentral.dynamics.com/v2.0/f44eef10-122f-4a63-9f5c-bd9fbd87a364/TestDK/api/v2.0",
    defaultLocalCurrency: "DKK",
  },
  NO: {
    discoveryUrlVariable: "BUSINESS_CENTRAL_NO_DISCOVERY_URL",
    companyIdVariable: "BUSINESS_CENTRAL_NO_COMPANY_ID",
    localCurrencyVariable: "BUSINESS_CENTRAL_NO_LCY_CODE",
    defaultLocalCurrency: "NOK",
  },
};

export type BusinessCentralEndpoint = {
  environment: BusinessCentralEnvironment;
  // The standard API root: https://api.businesscentral.dynamics.com/v2.0/{tenant}/{environment}/api/v2.0
  discoveryUrl: URL;
  tenantId: string;
  // https://api.businesscentral.dynamics.com/v2.0/{tenant}/{environment}, the root of ODataV4 and
  // the custom APIs.
  environmentBaseUrl: string;
};

// A missing or invalid setting is the operator's problem, not the caller's (NIMBUS-261). The type is
// outside Medusa's HTTP error map, so the error handler logs the message and answers the generic
// 500 without it; it stays a MedusaError, so a sync still reports the call as failed.
const BUSINESS_CENTRAL_CONFIGURATION_ERROR = "business_central_configuration";

export function businessCentralConfigurationError(message: string): MedusaError {
  return new MedusaError(BUSINESS_CENTRAL_CONFIGURATION_ERROR, message);
}

// Messages name the variable and the environment only, never the configured value (it holds the
// tenant).
function configurationError(
  variable: string,
  environment: BusinessCentralEnvironment,
  requirement: string
): MedusaError {
  return businessCentralConfigurationError(
    `${variable} ${requirement} (Business Central environment ${environment})`
  );
}

export function getBusinessCentralEndpoint(
  environment: BusinessCentralEnvironment
): BusinessCentralEndpoint {
  const { discoveryUrlVariable: variable, defaultDiscoveryUrl } = SETTINGS[environment];
  const configured = process.env[variable] ?? defaultDiscoveryUrl;

  if (!configured?.trim()) {
    throw configurationError(variable, environment, "is required");
  }

  let discoveryUrl: URL;

  try {
    discoveryUrl = new URL(configured);
  } catch {
    throw configurationError(variable, environment, "must be a valid URL");
  }

  if (discoveryUrl.protocol !== "https:") {
    throw configurationError(variable, environment, "must use https");
  }

  if (discoveryUrl.hostname !== BUSINESS_CENTRAL_API_HOST) {
    throw configurationError(variable, environment, `must target ${BUSINESS_CENTRAL_API_HOST}`);
  }

  const [apiVersion, tenantId, bcEnvironment] = discoveryUrl.pathname.split("/").filter(Boolean);

  if (apiVersion !== "v2.0" || !tenantId || !bcEnvironment) {
    throw configurationError(
      variable,
      environment,
      "must have the form /v2.0/{tenant}/{environment}/api/v2.0"
    );
  }

  return {
    environment,
    discoveryUrl,
    tenantId,
    environmentBaseUrl: `https://${discoveryUrl.hostname}/v2.0/${tenantId}/${bcEnvironment}`,
  };
}

export function getBusinessCentralCompanyId(environment: BusinessCentralEnvironment): string {
  const variable = SETTINGS[environment].companyIdVariable;
  const companyId = process.env[variable];

  if (!companyId || !AZURE_GUID_PATTERN.test(companyId)) {
    throw configurationError(variable, environment, "must be the Business Central company ID GUID");
  }

  return companyId;
}

// The currency BC means by a blank currency code (its local currency, LCY).
export function getBusinessCentralLocalCurrency(environment: BusinessCentralEnvironment): string {
  const { localCurrencyVariable, defaultLocalCurrency } = SETTINGS[environment];

  return process.env[localCurrencyVariable]?.trim() || defaultLocalCurrency;
}
