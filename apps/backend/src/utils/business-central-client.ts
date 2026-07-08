import { MedusaError } from "@medusajs/framework/utils";

const DEFAULT_BUSINESS_CENTRAL_DISCOVERY_URL =
  "https://api.businesscentral.dynamics.com/v2.0/f44eef10-122f-4a63-9f5c-bd9fbd87a364/TestDK/api/v2.0";
const BUSINESS_CENTRAL_SCOPE =
  "https://api.businesscentral.dynamics.com/.default";
const AZURE_GUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

type BusinessCentralTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type BusinessCentralTokenErrorResponse = {
  error?: string;
  error_description?: string;
};

function getBusinessCentralDiscoveryUrl(): URL {
  const configuredUrl =
    process.env.BUSINESS_CENTRAL_DISCOVERY_URL ??
    DEFAULT_BUSINESS_CENTRAL_DISCOVERY_URL;
  const discoveryUrl = new URL(configuredUrl);

  if (discoveryUrl.protocol !== "https:") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "BUSINESS_CENTRAL_DISCOVERY_URL must use https"
    );
  }

  if (discoveryUrl.hostname !== "api.businesscentral.dynamics.com") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "BUSINESS_CENTRAL_DISCOVERY_URL must target api.businesscentral.dynamics.com"
    );
  }

  return discoveryUrl;
}

function getBusinessCentralTenantId(discoveryUrl: URL): string {
  const pathSegments = discoveryUrl.pathname.split("/").filter(Boolean);
  const apiVersion = pathSegments[0];
  const tenantId = pathSegments[1];

  if (apiVersion !== "v2.0") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "BUSINESS_CENTRAL_DISCOVERY_URL must start with /v2.0/{tenant}/..."
    );
  }

  if (!tenantId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "BUSINESS_CENTRAL_DISCOVERY_URL must include tenant id in /v2.0/{tenant}/..."
    );
  }

  return tenantId;
}

function getBusinessCentralClientCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = process.env.BUSINESS_CENTRAL_CLIENT_ID;
  const clientSecret = process.env.BUSINESS_CENTRAL_CLIENT_SECRET;

  if (!clientId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "BUSINESS_CENTRAL_CLIENT_ID is required"
    );
  }

  if (!clientSecret) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "BUSINESS_CENTRAL_CLIENT_SECRET is required"
    );
  }

  if (!AZURE_GUID_PATTERN.test(clientId)) {
    const swappedCredentialsHint = AZURE_GUID_PATTERN.test(clientSecret)
      ? " BUSINESS_CENTRAL_CLIENT_SECRET looks like a GUID, so the two values may be swapped."
      : "";

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `BUSINESS_CENTRAL_CLIENT_ID must be the Azure application client ID GUID.${swappedCredentialsHint}`
    );
  }

  return {
    clientId,
    clientSecret,
  };
}

async function getBusinessCentralTokenErrorMessage(
  tokenResponse: Response
): Promise<string> {
  const responseText = await tokenResponse.text();

  if (!responseText) {
    return `Business Central token request failed with status ${tokenResponse.status}`;
  }

  try {
    const errorBody = JSON.parse(
      responseText
    ) as BusinessCentralTokenErrorResponse;

    if (errorBody.error_description) {
      return `Business Central token request failed: ${errorBody.error_description}`;
    }

    if (errorBody.error) {
      return `Business Central token request failed: ${errorBody.error}`;
    }
  } catch {
    // Fall back to the raw response text below.
  }

  return `Business Central token request failed with status ${tokenResponse.status}: ${responseText}`;
}

async function requestBusinessCentralToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const tokenRequest = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: BUSINESS_CENTRAL_SCOPE,
  });

  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: tokenRequest.toString(),
  });

  if (!tokenResponse.ok) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      await getBusinessCentralTokenErrorMessage(tokenResponse)
    );
  }

  const tokenBody =
    (await tokenResponse.json()) as Partial<BusinessCentralTokenResponse>;
  const accessToken = tokenBody.access_token;

  if (!accessToken) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Business Central token response did not include access_token"
    );
  }

  return accessToken;
}

export async function getBusinessCentralOperations(): Promise<unknown> {
  const discoveryUrl = getBusinessCentralDiscoveryUrl();
  const tenantId = getBusinessCentralTenantId(discoveryUrl);
  const { clientId, clientSecret } = getBusinessCentralClientCredentials();
  const accessToken = await requestBusinessCentralToken(
    tenantId,
    clientId,
    clientSecret
  );

  const operationsResponse = await fetch(discoveryUrl.toString(), {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  });

  if (!operationsResponse.ok) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Business Central operations request failed with status ${operationsResponse.status}`
    );
  }

  return operationsResponse.json();
}
