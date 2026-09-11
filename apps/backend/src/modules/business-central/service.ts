import { MedusaError } from "@medusajs/framework/utils";
import type {
  BCGetOrderBySalesOrderIdParams,
  BCGetOrderParams,
  BCListOrdersParams,
  BCListOrdersResult,
  BCOrder,
  BCOrderDetail,
  BCOrderInvoiceSummary,
  BCOrderLine,
  BCCreateReturnParams,
  BCCustomer,
  BCCustomerBlockedState,
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
const BC_BLOCKED_UNBLOCKED_WIRE_VALUE = "_x0020_";
const BC_BLOCKED_STATES: readonly BCCustomerBlockedState[] = [
  "not_blocked",
  "Ship",
  "Invoice",
  "All",
];
const SALES_ORDER_DEDUP_FETCH_CAP = 1000;
const INVOICE_FILL_BATCH_SIZE = 50;
const MAX_INVOICE_FILL_ROUND_TRIPS = 10;
const MAX_ORDER_DETAIL_INVOICES = 50;

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

function optionalString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeBlockedState(value: unknown): BCCustomerBlockedState {
  if (
    value === BC_BLOCKED_UNBLOCKED_WIRE_VALUE ||
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "not_blocked";
  }

  if (
    typeof value === "string" &&
    BC_BLOCKED_STATES.includes(value as BCCustomerBlockedState)
  ) {
    return value as BCCustomerBlockedState;
  }

  throw new MedusaError(
    MedusaError.Types.UNEXPECTED_STATE,
    "Unsupported Business Central blocked value"
  );
}

function parseCreditLimit(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  throw new MedusaError(
    MedusaError.Types.UNEXPECTED_STATE,
    "Malformed Business Central creditLimit"
  );
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

type BCSalesOrderRaw = {
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

type BCSalesInvoiceRaw = {
  id: string;
  number: unknown;
  orderNumber: unknown;
  invoiceDate: string;
  customerNumber: string;
  customerName: string;
  billToName?: string;
  billToAddressLine1?: string;
  billToAddressLine2?: string;
  billToCity?: string;
  billToPostCode?: string;
  billToCountry?: string;
  shipToName?: string;
  shipToAddressLine1?: string;
  shipToAddressLine2?: string;
  shipToCity?: string;
  shipToPostCode?: string;
  shipToCountry?: string;
  status: string;
  currencyCode: string;
  totalAmountExcludingTax?: number;
  totalAmountIncludingTax?: number;
};

function mapSalesOrderToBCOrder(item: BCSalesOrderRaw): BCOrder {
  return {
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
    status: item.status,
    invoiceStatus: "open",
    currencyCode: item.currencyCode,
    totalAmountExcludingTax: item.totalAmountExcludingTax ?? 0,
    totalAmountIncludingTax: item.totalAmountIncludingTax ?? 0,
  };
}

function mapSalesInvoiceToBCOrder(item: BCSalesInvoiceRaw): BCOrder {
  return {
    id: item.id,
    number: requireBusinessCentralString(item.orderNumber, "orderNumber"),
    orderDate: item.invoiceDate,
    customerNumber: item.customerNumber,
    customerName: item.customerName,
    billToAddress: formatAddress(
      item.billToName,
      item.billToAddressLine1,
      item.billToAddressLine2,
      item.billToCity,
      item.billToPostCode,
      item.billToCountry
    ),
    shipToAddress: formatAddress(
      item.shipToName,
      item.shipToAddressLine1,
      item.shipToAddressLine2,
      item.shipToCity,
      item.shipToPostCode,
      item.shipToCountry
    ),
    status: item.status,
    invoiceStatus: "fully_invoiced",
    currencyCode: item.currencyCode,
    totalAmountExcludingTax: item.totalAmountExcludingTax ?? 0,
    totalAmountIncludingTax: item.totalAmountIncludingTax ?? 0,
  };
}

type BCSalesOrderLineRaw = {
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

type BCSalesInvoiceLineRaw = {
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

function mapSalesOrderLine(line: BCSalesOrderLineRaw): BCOrderLine {
  return {
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
  };
}

function mapSalesInvoiceLine(line: BCSalesInvoiceLineRaw): BCOrderLine {
  return {
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
  };
}

function mapSalesInvoiceToSummary(invoice: BCSalesInvoiceRaw): BCOrderInvoiceSummary {
  return {
    id: invoice.id,
    number: requireBusinessCentralString(invoice.number, "number"),
    invoiceDate: invoice.invoiceDate,
    status: invoice.status,
    totalAmountExcludingTax: invoice.totalAmountExcludingTax ?? 0,
    totalAmountIncludingTax: invoice.totalAmountIncludingTax ?? 0,
  };
}

class BusinessCentralModuleService implements IBusinessCentralModuleService {
  private getDiscoveryUrl(): URL {
    const configuredUrl =
      process.env.BUSINESS_CENTRAL_DISCOVERY_URL ??
      DEFAULT_BUSINESS_CENTRAL_DISCOVERY_URL;
    let discoveryUrl: URL;

    try {
      discoveryUrl = new URL(configuredUrl);
    } catch {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "BUSINESS_CENTRAL_DISCOVERY_URL must be a valid URL"
      );
    }

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

    let tokenResponse: Response;

    try {
      tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: tokenRequest.toString(),
      });
    } catch {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Business Central token request failed"
      );
    }

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

  async getCustomer(customerNumber: string): Promise<BCCustomer | null> {
    const discoveryUrl = this.getDiscoveryUrl();
    const tenantId = this.getTenantId(discoveryUrl);
    const { clientId, clientSecret } = this.getClientCredentials();
    const accessToken = await this.requestToken(tenantId, clientId, clientSecret);

    const customersUrl = new URL(`${discoveryUrl.toString()}/customers()`);
    customersUrl.searchParams.set(
      "$filter",
      `number eq '${escapeODataString(customerNumber)}'`
    );
    customersUrl.searchParams.set("$top", "1");
    customersUrl.searchParams.set("$expand", "currency");

    let customersResponse: Response;

    try {
      customersResponse = await fetch(customersUrl.toString(), {
        method: "GET",
        headers: {
          authorization: ["Bearer", accessToken].join(" "),
          accept: "application/json",
        },
      });
    } catch {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Business Central customer request failed"
      );
    }

    if (!customersResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central customer request failed with status ${customersResponse.status}`
      );
    }

    type BCCustomerRaw = {
      number?: unknown;
      displayName?: unknown;
      email?: unknown;
      phoneNumber?: unknown;
      addressLine1?: unknown;
      addressLine2?: unknown;
      city?: unknown;
      state?: unknown;
      postalCode?: unknown;
      country?: unknown;
      blocked?: unknown;
      creditLimit?: unknown;
      taxRegistrationNumber?: unknown;
      currency?: { code?: unknown } | null;
    };

    let body: { value?: BCCustomerRaw[] };

    try {
      body = (await customersResponse.json()) as {
        value?: BCCustomerRaw[];
      };
    } catch {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Malformed Business Central customer response"
      );
    }
    const raw = body.value?.[0];

    if (!raw) {
      return null;
    }

    return {
      number: optionalString(raw.number),
      displayName: optionalString(raw.displayName),
      email: optionalString(raw.email),
      phoneNumber: optionalString(raw.phoneNumber),
      addressLine1: optionalString(raw.addressLine1),
      addressLine2: optionalString(raw.addressLine2),
      city: optionalString(raw.city),
      state: optionalString(raw.state),
      postalCode: optionalString(raw.postalCode),
      country: optionalString(raw.country),
      blocked: normalizeBlockedState(raw.blocked),
      creditLimit: parseCreditLimit(raw.creditLimit),
      taxRegistrationNumber: optionalString(raw.taxRegistrationNumber),
      currencyCode:
        typeof raw.currency?.code === "string" ? raw.currency.code : null,
    };
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

  private async fetchAllSalesOrderNumbers(
    discoveryUrl: URL,
    accessToken: string,
    orderFilters: string[]
  ): Promise<Set<string>> {
    const url = new URL(`${discoveryUrl.toString()}/salesOrders()`);
    url.searchParams.set("$filter", orderFilters.join(" and "));
    url.searchParams.set("$top", String(SALES_ORDER_DEDUP_FETCH_CAP));

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central orders request failed with status ${response.status}`
      );
    }

    const body = (await response.json()) as {
      value?: Array<{ number?: unknown }>;
    };
    const numbers = new Set<string>();

    for (const item of body.value ?? []) {
      if (typeof item.number === "string" && item.number.length > 0) {
        numbers.add(item.number);
      }
    }

    return numbers;
  }

  private async fetchSalesInvoicesBatch(
    discoveryUrl: URL,
    accessToken: string,
    invoiceFilters: string[],
    top: number,
    skip: number
  ): Promise<BCSalesInvoiceRaw[]> {
    const url = new URL(`${discoveryUrl.toString()}/salesInvoices()`);
    url.searchParams.set("$filter", invoiceFilters.join(" and "));
    url.searchParams.set("$top", String(top));
    url.searchParams.set("$skip", String(skip));
    url.searchParams.set("$orderby", "invoiceDate desc");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central invoices request failed with status ${response.status}`
      );
    }

    const body = (await response.json()) as { value?: BCSalesInvoiceRaw[] };
    return body.value ?? [];
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

    const orderFilters: string[] = [`customerId eq ${escapeODataString(customerId)}`];
    if (params.status) {
      orderFilters.push(`status eq '${escapeODataString(params.status)}'`);
    }
    if (params.date_from) {
      orderFilters.push(`orderDate ge ${params.date_from}`);
    }
    if (params.date_to) {
      orderFilters.push(`orderDate le ${params.date_to}`);
    }
    if (params.search) {
      orderFilters.push(`contains(number,'${escapeODataString(params.search)}')`);
    }

    const invoiceFilters: string[] = [`customerId eq ${escapeODataString(customerId)}`];
    if (params.status) {
      invoiceFilters.push(`status eq '${escapeODataString(params.status)}'`);
    }
    if (params.date_from) {
      invoiceFilters.push(`invoiceDate ge ${params.date_from}`);
    }
    if (params.date_to) {
      invoiceFilters.push(`invoiceDate le ${params.date_to}`);
    }
    if (params.search) {
      invoiceFilters.push(`contains(orderNumber,'${escapeODataString(params.search)}')`);
    }

    const odataUrl = new URL(`${discoveryUrl.toString()}/salesOrders()`);
    odataUrl.searchParams.set("$filter", orderFilters.join(" and "));
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

    const ordersBody = (await ordersResponse.json()) as {
      "@odata.count"?: number;
      value: BCSalesOrderRaw[];
    };
    const salesOrdersTotal = ordersBody["@odata.count"] ?? 0;
    const orders: BCOrder[] = (ordersBody.value ?? []).map(mapSalesOrderToBCOrder);

    const invoicesCountUrl = new URL(`${discoveryUrl.toString()}/salesInvoices()`);
    invoicesCountUrl.searchParams.set("$filter", invoiceFilters.join(" and "));
    invoicesCountUrl.searchParams.set("$top", "1");
    invoicesCountUrl.searchParams.set("$count", "true");

    const invoicesCountResponse = await fetch(invoicesCountUrl.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });

    if (!invoicesCountResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central invoices request failed with status ${invoicesCountResponse.status}`
      );
    }

    const invoicesCountBody = (await invoicesCountResponse.json()) as {
      "@odata.count"?: number;
    };
    const invoicesRawCountApprox = invoicesCountBody["@odata.count"] ?? 0;

    const remainder = params.limit - orders.length;
    let invoiceOnlyOrders: BCOrder[] = [];

    if (remainder > 0) {
      const dedupOrderNumbers = await this.fetchAllSalesOrderNumbers(
        discoveryUrl,
        accessToken,
        orderFilters
      );

      const skipPastInvoiceOnly = Math.max(0, params.offset - salesOrdersTotal);
      const seenInvoiceOrderNumbers = new Set<string>();
      const collected: BCOrder[] = [];
      let skippedSoFar = 0;
      let rawInvoiceSkip = 0;
      let roundTrips = 0;

      while (
        collected.length < remainder &&
        roundTrips < MAX_INVOICE_FILL_ROUND_TRIPS
      ) {
        const batch = await this.fetchSalesInvoicesBatch(
          discoveryUrl,
          accessToken,
          invoiceFilters,
          INVOICE_FILL_BATCH_SIZE,
          rawInvoiceSkip
        );
        roundTrips += 1;

        if (batch.length === 0) {
          break;
        }

        for (const raw of batch) {
          if (typeof raw.orderNumber !== "string" || raw.orderNumber.length === 0) {
            continue;
          }
          if (dedupOrderNumbers.has(raw.orderNumber)) {
            continue;
          }
          if (seenInvoiceOrderNumbers.has(raw.orderNumber)) {
            continue;
          }
          seenInvoiceOrderNumbers.add(raw.orderNumber);

          if (skippedSoFar < skipPastInvoiceOnly) {
            skippedSoFar += 1;
            continue;
          }

          collected.push(mapSalesInvoiceToBCOrder(raw));
          if (collected.length === remainder) {
            break;
          }
        }

        rawInvoiceSkip += batch.length;
        if (batch.length < INVOICE_FILL_BATCH_SIZE) {
          break;
        }
      }

      invoiceOnlyOrders = collected;
    }

    return {
      orders: [...orders, ...invoiceOnlyOrders],
      count: salesOrdersTotal + invoicesRawCountApprox,
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

    const orderUrl = new URL(`${discoveryUrl.toString()}/salesOrders()`);
    orderUrl.searchParams.set(
      "$filter",
      [
        `customerId eq ${escapeODataString(customerId)}`,
        `number eq '${escapeODataString(params.orderNumber)}'`,
      ].join(" and ")
    );
    orderUrl.searchParams.set("$top", "1");
    orderUrl.searchParams.set("$expand", "salesOrderLines($expand=item)");

    const invoicesUrl = new URL(`${discoveryUrl.toString()}/salesInvoices()`);
    invoicesUrl.searchParams.set(
      "$filter",
      [
        `customerId eq ${escapeODataString(customerId)}`,
        `orderNumber eq '${escapeODataString(params.orderNumber)}'`,
      ].join(" and ")
    );
    invoicesUrl.searchParams.set("$top", String(MAX_ORDER_DETAIL_INVOICES));
    invoicesUrl.searchParams.set("$orderby", "invoiceDate asc");
    invoicesUrl.searchParams.set("$expand", "salesInvoiceLines($expand=item)");

    const [orderResponse, invoicesResponse] = await Promise.all([
      fetch(orderUrl.toString(), {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/json",
        },
      }),
      fetch(invoicesUrl.toString(), {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/json",
        },
      }),
    ]);

    if (!orderResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central order request failed with status ${orderResponse.status}`
      );
    }

    if (!invoicesResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central invoices request failed with status ${invoicesResponse.status}`
      );
    }

    type BCSalesOrderWithLinesRaw = BCSalesOrderRaw & {
      salesOrderLines?: BCSalesOrderLineRaw[];
    };
    type BCSalesInvoiceWithLinesRaw = BCSalesInvoiceRaw & {
      salesInvoiceLines?: BCSalesInvoiceLineRaw[];
    };

    const orderBody = (await orderResponse.json()) as {
      value?: BCSalesOrderWithLinesRaw[];
    };
    const invoicesBody = (await invoicesResponse.json()) as {
      value?: BCSalesInvoiceWithLinesRaw[];
    };

    const order = orderBody.value?.[0];
    const invoices = invoicesBody.value ?? [];

    if (!order && invoices.length === 0) {
      return null;
    }

    if (order) {
      const orderLines: BCOrderLine[] = [...(order.salesOrderLines ?? [])]
        .sort((left, right) => left.sequence - right.sequence)
        .map(mapSalesOrderLine);

      const invoiceLines: BCOrderLine[] = invoices.flatMap((invoice) =>
        [...(invoice.salesInvoiceLines ?? [])]
          .sort((left, right) => left.sequence - right.sequence)
          .map(mapSalesInvoiceLine)
      );

      const base = mapSalesOrderToBCOrder(order);

      return {
        ...base,
        invoiceStatus: invoices.length > 0 ? "partially_invoiced" : "open",
        lines: [...orderLines, ...invoiceLines],
        invoices: invoices.map(mapSalesInvoiceToSummary),
      };
    }

    const earliestInvoice = invoices[0];
    const latestInvoice = invoices[invoices.length - 1];
    const base = mapSalesInvoiceToBCOrder(latestInvoice);

    const lines: BCOrderLine[] = invoices.flatMap((invoice) =>
      [...(invoice.salesInvoiceLines ?? [])]
        .sort((left, right) => left.sequence - right.sequence)
        .map(mapSalesInvoiceLine)
    );

    return {
      ...base,
      orderDate: earliestInvoice.invoiceDate,
      totalAmountExcludingTax: invoices.reduce(
        (sum, invoice) => sum + (invoice.totalAmountExcludingTax ?? 0),
        0
      ),
      totalAmountIncludingTax: invoices.reduce(
        (sum, invoice) => sum + (invoice.totalAmountIncludingTax ?? 0),
        0
      ),
      invoiceStatus: "fully_invoiced",
      lines,
      invoices: invoices.map(mapSalesInvoiceToSummary),
    };
  }

  // Used only by the business-central-return workflow (see NIMBUS-170 D6). Returns are out
  // of scope for NIMBUS-170; this preserves the pre-NIMBUS-170 salesOrders-only, id-based
  // lookup so that flow is unaffected by getOrder's move to a number-based, merged lookup.
  async getOrderBySalesOrderId(
    params: BCGetOrderBySalesOrderIdParams
  ): Promise<BCOrderDetail | null> {
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

    const orderUrl = new URL(`${discoveryUrl.toString()}/salesOrders()`);
    orderUrl.searchParams.set(
      "$filter",
      [
        `customerId eq ${escapeODataString(customerId)}`,
        `id eq ${escapeODataString(params.orderId)}`,
      ].join(" and ")
    );
    orderUrl.searchParams.set("$top", "1");
    orderUrl.searchParams.set("$expand", "salesOrderLines($expand=item)");

    const orderResponse = await fetch(orderUrl.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });

    if (!orderResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Business Central order request failed with status ${orderResponse.status}`
      );
    }

    type BCSalesOrderWithLinesRaw = BCSalesOrderRaw & {
      salesOrderLines?: BCSalesOrderLineRaw[];
    };

    const orderBody = (await orderResponse.json()) as {
      value?: BCSalesOrderWithLinesRaw[];
    };
    const order = orderBody.value?.[0];

    if (!order) {
      return null;
    }

    const lines: BCOrderLine[] = [...(order.salesOrderLines ?? [])]
      .sort((left, right) => left.sequence - right.sequence)
      .map(mapSalesOrderLine);

    return {
      ...mapSalesOrderToBCOrder(order),
      lines,
      invoices: [],
    };
  }
}

export default BusinessCentralModuleService;
