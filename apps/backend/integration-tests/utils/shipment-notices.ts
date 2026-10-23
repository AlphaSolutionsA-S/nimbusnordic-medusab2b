import { ApiKeyType, Modules } from "@medusajs/framework/utils";
import type { IApiKeyModuleService, MedusaContainer } from "@medusajs/framework/types";
import { COMPANY_MODULE } from "../../src/modules/company";
import type { ICompanyModuleService } from "../../src/types";
import { ORDER_INGESTION_MODULE } from "../../src/modules/order-ingestion";
import type OrderIngestionModuleService from "../../src/modules/order-ingestion/service";
import {
  shipmentNoticeEnvelopeExample,
} from "../../src/modules/order-ingestion/__fixtures__/shipment-notice-fixtures";
import {
  ShipmentNoticePayloadSchema,
  type ShipmentNoticePayload,
  type ShipmentNoticeStatus,
} from "../../src/modules/order-ingestion/shipment-notice-contract";

const {
  cursor: _cursor,
  previous_cursor: _previousCursor,
  recorded_at: _recordedAt,
  revision: _revision,
  status: _status,
  ...examplePayloadFields
} = shipmentNoticeEnvelopeExample.shipment_notices[0];

/** The contract example's notice without its row fields: names and addresses are fictitious. */
export const EXAMPLE_SHIPMENT_NOTICE_PAYLOAD: ShipmentNoticePayload =
  ShipmentNoticePayloadSchema.parse(examplePayloadFields);

/** `Authorization` header of a fresh secret API key, as the Logic App sends it. */
export async function orderApiSecretHeaders(
  container: MedusaContainer
): Promise<{ authorization: string }> {
  const secretKey = await container.resolve<IApiKeyModuleService>(Modules.API_KEY).createApiKeys({
    title: "orderapi shipment notices key",
    type: ApiKeyType.SECRET,
    created_by: "test",
  });
  return { authorization: `Basic ${secretKey.token}` };
}

export async function createApiCustomerCompany(
  container: MedusaContainer,
  customerNumber: string
): Promise<string> {
  const company = await container.resolve<ICompanyModuleService>(COMPANY_MODULE).createCompanies({
    name: `Notice Co ${customerNumber}`,
    phone: "+4500000000",
    email: `notices-${customerNumber}@example.com`,
    address: null,
    city: null,
    state: null,
    zip: null,
    country: "dk",
    logo_url: null,
    currency_code: "dkk",
    business_central_customer_number: customerNumber,
    spending_limit_reset_frequency: null,
    order_api_enabled: true,
  });
  return company.id;
}

/** Switches a company on or off for the order API, as an Admin user does. */
export async function setOrderApiEnabled(
  container: MedusaContainer,
  companyId: string,
  enabled: boolean
): Promise<void> {
  await container.resolve<ICompanyModuleService>(COMPANY_MODULE).updateCompanies({
    id: companyId,
    order_api_enabled: enabled,
  });
}

/**
 * Stores one revision of a shipment the way a check run does: tracks the shipment on its first
 * revision, then stores against the previous revision. Returns the stored sequence.
 */
export async function storeShipmentNoticeRevision(
  container: MedusaContainer,
  input: {
    company_id: string;
    bc_shipment_id: string;
    revision: number;
    status?: ShipmentNoticeStatus;
    payload?: ShipmentNoticePayload;
  }
): Promise<number> {
  const service = container.resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);
  const payload = input.payload ?? EXAMPLE_SHIPMENT_NOTICE_PAYLOAD;
  const now = new Date();
  await service.initializeShipmentPollState(now);
  if (input.revision === 1) {
    await service.upsertShipmentTracking([{
      bc_shipment_id: input.bc_shipment_id,
      shipment_number: payload.shipment_number,
      bc_order_number: payload.bc_order_number,
      posting_date: payload.shipment_date,
      company_id: input.company_id,
      order_id: payload.order_id,
      external_order_number: payload.external_order_number,
      next_check_at: now,
      recheck_until: new Date(now.getTime() + 14 * 24 * 60 * 60_000),
    }]);
  }
  const result = await service.storeShipmentNotice({
    bc_shipment_id: input.bc_shipment_id,
    expected_revision: input.revision - 1,
    company_id: input.company_id,
    order_id: payload.order_id,
    external_order_number: payload.external_order_number,
    bc_order_number: payload.bc_order_number,
    shipment_number: payload.shipment_number,
    shipment_date: payload.shipment_date,
    bc_last_modified_at: now,
    status: input.status ?? (input.revision === 1 ? "shipped" : "revised"),
    content_hash: `hash-${input.bc_shipment_id}-${input.revision}`,
    payload,
    tracking: {
      action: "reschedule",
      next_check_at: new Date(now.getTime() + 15 * 60_000),
      attempts: 0,
      last_error: null,
      last_checked_at: now,
      final_check_done: false,
    },
  });
  if (result.outcome !== "stored") {
    throw new Error(`Seeding shipment notice failed: ${result.outcome}`);
  }
  return result.sequence;
}
