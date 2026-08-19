import { MedusaError } from "@medusajs/framework/utils";
import type {
  BCGetOrderParams,
  BCListOrdersParams,
  BCListOrdersResult,
  BCOrder,
  BCOrderDetail,
  BCOrderLine,
  BCCreateReturnParams,
  BCReturnOrder,
  BCReturnReason,
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

export class BusinessCentralAmbiguousOutcomeError extends Error {
  constructor(
    message: string,
    readonly idempotencyKey: string
  ) {
    super(message);
    this.name = "BusinessCentralAmbiguousOutcomeError";
  }
}

function requireBusinessCentralString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Business Central response field ${fieldName} must be a string`
    );
  }

  return value;
}

function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

function formatAddress(
  name: string | undefined,
  addressLine1: string | undefined,
  addressLine2: string | undefined,
  city: string | undefined,
  postalCode: string | undefined,
  country: string | undefined
): string[] {
  const cityLine = [postalCode, city].filter(Boolean).join(" ");

  return [name, addressLine1, addressLine2, cityLine, country].filter(
    (value): value is string => Boolean(value)
  );
}

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

  // STUB (NIMBUS-138 task 09): replace with the real BC custom-action HTTP call.
  async createReturnFromSalesOrder(
    params: BCCreateReturnParams
  ): Promise<BCReturnOrder> {
    if (!params.requestId || !params.sourceOrderNo || params.lines.length === 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A return request must include an ID, source order, and at least one line."
      );
    }

    for (const line of params.lines) {
      if (line.quantityToReturn <= 0 || !line.returnReasonCode) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Each return line must have a positive quantity and return reason."
        );
      }
    }

    return {
      id: `bcret_stub_${params.requestId}`,
      number: params.requestId,
      status: "Open",
      requestId: params.requestId,
      sourceOrderNo: params.sourceOrderNo,
      lines: params.lines.map((line) => ({
        sourceLineNo: line.sourceLineNo,
        quantityToReturn: line.quantityToReturn,
        returnReasonCode: line.returnReasonCode,
      })),
    };
  }

  // STUB (NIMBUS-138 task 09): replace with the verified BC return-reason source.
  async listReturnReasons(): Promise<BCReturnReason[]> {
    return [
      { id: "DAMAGED", description: "Item arrived damaged or defective" },
      { id: "WRONGITEM", description: "Wrong item was delivered" },
      {
        id: "NOTORDERED",
        description: "Item was not ordered by the customer",
      },
      { id: "QUALITY", description: "Item does not meet expected quality" },
      { id: "OTHER", description: "Other reason (specified separately)" },
    ];
  }

  private async getCustomerId(
    discoveryUrl: URL,
    accessToken: string,
    customerNumber: string
  ): Promise<string | null> {
    const customersUrl = new URL(`${discoveryUrl.toString()}/customers()`);
    customersUrl.searchParams.set(
      "$filter",
      `number eq '${escapeODataString(customerNumber)}'`
    );
    customersUrl.searchParams.set("$top", "1");

    const customersResponse = await fetch(customersUrl.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });

    if (!customersResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central customer request failed with status ${customersResponse.status}`
      );
    }

    const customersBody = (await customersResponse.json()) as {
      value?: Array<{ id?: string }>;
    };
    const customerId = customersBody.value?.[0]?.id;

    return customerId ?? null;
  }

  async listOrders(params: BCListOrdersParams): Promise<BCListOrdersResult> {
    const discoveryUrl = this.getDiscoveryUrl();
    const tenantId = this.getTenantId(discoveryUrl);
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);
    const customerId = await this.getCustomerId(
      discoveryUrl,
      accessToken,
      params.customerNumber
    );

    if (!customerId) {
      return {
        orders: [],
        count: 0,
        offset: params.offset,
        limit: params.limit,
      };
    }

    // Build OData $filter
    const filters: string[] = [];
    filters.push(`customerId eq ${escapeODataString(customerId)}`);

    if (params.status) {
      filters.push(`status eq '${escapeODataString(params.status)}'`);
    }
    if (params.date_from) {
      filters.push(`orderDate ge ${params.date_from}`);
    }
    if (params.date_to) {
      filters.push(`orderDate le ${params.date_to}`);
    }
    if (params.search) {
      filters.push(`contains(number,'${escapeODataString(params.search)}')`);
    }

    const odataUrl = new URL(`${discoveryUrl.toString()}/SalesOrders()`);
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

    const responseText = await ordersResponse.text();

    type BCOrderRaw = {
      id: string;
      number: unknown;
      orderDate: string;
      customerNumber: string;
      customerName: string;
      billToName?: string;
      billToAddressLine1?: string;
      billToAddressLine2?: string;
      billToCity?: string;
      billToPostalCode?: string;
      billToCountry?: string;
      shipToName?: string;
      shipToAddressLine1?: string;
      shipToAddressLine2?: string;
      shipToCity?: string;
      shipToPostalCode?: string;
      shipToCountry?: string;
      status: string;
      currencyCode: string;
      totalAmountExcludingTax?: number;
      totalAmountIncludingTax?: number;
    };

    const body = JSON.parse(responseText) as {
      "@odata.count"?: number;
      value: BCOrderRaw[];
    };

    const orders: BCOrder[] = (body.value ?? []).map((item) => ({
      id: item.id,
      number: requireBusinessCentralString(item.number, "number"),
      orderDate: item.orderDate,
      customerNumber: item.customerNumber,
      customerName: item.customerName,
      billToAddress: formatAddress(
        item.billToName,
        item.billToAddressLine1,
        item.billToAddressLine2,
        item.billToCity,
        item.billToPostalCode,
        item.billToCountry
      ),
      shipToAddress: formatAddress(
        item.shipToName,
        item.shipToAddressLine1,
        item.shipToAddressLine2,
        item.shipToCity,
        item.shipToPostalCode,
        item.shipToCountry
      ),
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

  async getOrder(params: BCGetOrderParams): Promise<BCOrderDetail | null> {
    const discoveryUrl = this.getDiscoveryUrl();
    const tenantId = this.getTenantId(discoveryUrl);
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);
    const customerId = await this.getCustomerId(
      discoveryUrl,
      accessToken,
      params.customerNumber
    );

    if (!customerId) {
      return null;
    }

    const ordersUrl = new URL(`${discoveryUrl.toString()}/salesOrders()`);
    ordersUrl.searchParams.set(
      "$filter",
      [
        `customerId eq ${escapeODataString(customerId)}`,
        `id eq ${escapeODataString(params.orderId)}`,
      ].join(" and ")
    );
    ordersUrl.searchParams.set("$top", "1");
    ordersUrl.searchParams.set("$expand", "salesOrderLines($expand=item)");

    const ordersResponse = await fetch(ordersUrl.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });

    if (!ordersResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central order request failed with status ${ordersResponse.status}`
      );
    }

    type BCOrderLineRaw = {
      id: string;
      sequence: number;
      lineType?: string;
      itemId?: string;
      item?: { number?: string; displayName?: string };
      description?: string;
      quantity?: number;
      unitPrice?: number;
      amountExcludingTax?: number;
    };

    type BCOrderRaw = {
      id: string;
      number: unknown;
      orderDate: string;
      customerNumber: string;
      customerName: string;
      billToName?: string;
      billToAddressLine1?: string;
      billToAddressLine2?: string;
      billToCity?: string;
      billToPostalCode?: string;
      billToCountry?: string;
      shipToName?: string;
      shipToAddressLine1?: string;
      shipToAddressLine2?: string;
      shipToCity?: string;
      shipToPostalCode?: string;
      shipToCountry?: string;
      status: string;
      currencyCode: string;
      totalAmountExcludingTax?: number;
      totalAmountIncludingTax?: number;
      salesOrderLines?: BCOrderLineRaw[];
    };

    const ordersBody = (await ordersResponse.json()) as {
      value?: BCOrderRaw[];
    };
    const order = ordersBody.value?.[0];

    if (!order) {
      return null;
    }

    const lines: BCOrderLine[] = [...(order.salesOrderLines ?? [])]
      .sort((left, right) => left.sequence - right.sequence)
      .map((line) => ({
        id: line.id,
        sequence: line.sequence,
        lineType: line.lineType ?? "",
        itemId: line.itemId,
        itemNumber: line.item?.number,
        itemDisplayName: line.item?.displayName,
        description: line.description ?? "",
        quantity: line.quantity ?? 0,
        unitPrice: line.unitPrice ?? 0,
        lineAmount: line.amountExcludingTax ?? 0,
      }));

    return {
      id: order.id,
      number: requireBusinessCentralString(order.number, "number"),
      orderDate: order.orderDate,
      customerNumber: order.customerNumber,
      customerName: order.customerName,
      billToAddress: formatAddress(
        order.billToName,
        order.billToAddressLine1,
        order.billToAddressLine2,
        order.billToCity,
        order.billToPostalCode,
        order.billToCountry
      ),
      shipToAddress: formatAddress(
        order.shipToName,
        order.shipToAddressLine1,
        order.shipToAddressLine2,
        order.shipToCity,
        order.shipToPostalCode,
        order.shipToCountry
      ),
      status: order.status as BCOrder["status"],
      currencyCode: order.currencyCode,
      totalAmountExcludingTax: order.totalAmountExcludingTax ?? 0,
      totalAmountIncludingTax: order.totalAmountIncludingTax ?? 0,
      lines,
    };
  }
}

export default BusinessCentralModuleService;
