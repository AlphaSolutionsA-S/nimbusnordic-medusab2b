import { MedusaError } from "@medusajs/framework/utils";
import type {
  BCListOrdersParams,
  BCListOrdersResult,
  BCOrder,
  IBusinessCentralModuleService,
} from "./types";

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

class BusinessCentralModuleService implements IBusinessCentralModuleService {
  private getDiscoveryUrl(): URL {
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

  private getTenantId(discoveryUrl: URL): string {
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

  private getClientCredentials(): { clientId: string; clientSecret: string } {
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

    return { clientId, clientSecret };
  }

  private async getTokenErrorMessage(tokenResponse: Response): Promise<string> {
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

  private async requestToken(
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
        await this.getTokenErrorMessage(tokenResponse)
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

  async getOperations(): Promise<unknown> {
    const discoveryUrl = this.getDiscoveryUrl();
    const tenantId = this.getTenantId(discoveryUrl);
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);

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

  async listOrders(params: BCListOrdersParams): Promise<BCListOrdersResult> {
    const discoveryUrl = this.getDiscoveryUrl();
    const tenantId = this.getTenantId(discoveryUrl);
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);

    // Build OData $filter
    const filters: string[] = [
      `customerNumber eq '${params.customerNumber}'`,
    ];
    if (params.status) {
      filters.push(`status eq '${params.status}'`);
    }
    if (params.date_from) {
      filters.push(`orderDate ge ${params.date_from}`);
    }
    if (params.date_to) {
      filters.push(`orderDate le ${params.date_to}`);
    }
    if (params.search) {
      const s = params.search.replace(/'/g, "''");
      filters.push(
        `(contains(number,'${s}') or contains(customerName,'${s}'))`
      );
    }

    const odataUrl = new URL(`${discoveryUrl.toString()}/salesOrders`);
    odataUrl.searchParams.set("$filter", filters.join(" and "));
    odataUrl.searchParams.set("$top", String(params.limit));
    odataUrl.searchParams.set("$skip", String(params.offset));
    odataUrl.searchParams.set("$count", "true");
    odataUrl.searchParams.set("$orderby", "orderDate desc");

    const ordersResponse = await fetch(odataUrl.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });

    if (!ordersResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central orders request failed with status ${ordersResponse.status}`
      );
    }

    type BCOrderRaw = {
      id: string;
      number: string;
      orderDate: string;
      customerNumber: string;
      customerName: string;
      status: string;
      currencyCode: string;
      totalAmountExcludingTax?: number;
      totalAmountIncludingTax?: number;
    };

    const body = (await ordersResponse.json()) as {
      "@odata.count"?: number;
      value: BCOrderRaw[];
    };

    const orders: BCOrder[] = (body.value ?? []).map((item) => ({
      id: item.id,
      number: item.number,
      orderDate: item.orderDate,
      customerNumber: item.customerNumber,
      customerName: item.customerName,
      status: item.status as BCOrder["status"],
      currencyCode: item.currencyCode,
      totalAmountExcludingTax: item.totalAmountExcludingTax ?? 0,
      totalAmountIncludingTax: item.totalAmountIncludingTax ?? 0,
    }));

    return {
      orders,
      count: body["@odata.count"] ?? 0,
      offset: params.offset,
      limit: params.limit,
    };
  }
}

export default BusinessCentralModuleService;
