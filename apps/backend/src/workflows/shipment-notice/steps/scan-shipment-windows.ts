import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { MedusaContainer } from "@medusajs/framework/types";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import { BusinessCentralThrottledError } from "../../../modules/business-central/shipment-reads";
import type {
  BCShipmentHeader,
  IBusinessCentralModuleService,
} from "../../../modules/business-central/types";
import { ORDER_INGESTION_MODULE } from "../../../modules/order-ingestion";
import {
  BC_INTEGRATION_STATE_METADATA_KEY,
  parseBcIntegrationState,
} from "../../../modules/order-ingestion/bc-integration-state";
import type OrderIngestionModuleService from "../../../modules/order-ingestion/service";
import type { ShipmentPollCursor } from "../../../modules/order-ingestion/shipment-notice-storage";
import {
  halveShipmentWindow,
  SHIPMENT_WINDOW_HEADER_BUDGET,
  shipmentTrackingForHeaders,
} from "../utils/discovery-window";
import type { ShipmentOrderCandidate } from "../utils/match-shipment-order";

export type ScanShipmentWindowsInput = {
  cursor: ShipmentPollCursor;
  after: string;
  bound: string;
  go_live_at: string;
  deadline: Date | string;
  /** Set on the first run and after a throttled scan: no BC request is made. */
  skip: boolean;
};

export type ScanShipmentWindowsResult = {
  headers: number;
  matched: number;
  tracked: number;
  /** The cursor after the scan. */
  cursor_at: string;
  /** The cursor reached the bound. */
  complete: boolean;
  throttled: boolean;
  retry_after_seconds: number | null;
};

function unique(values: readonly (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => value !== null))];
}

/** The API orders the headers' customer and external document numbers can belong to. */
async function loadOrderCandidates(
  container: MedusaContainer,
  orderIngestion: OrderIngestionModuleService,
  headers: readonly BCShipmentHeader[]
): Promise<ShipmentOrderCandidate[]> {
  const customerNumbers = unique(headers.map((header) => header.customerNumber));
  const externalNumbers = unique(headers.map((header) => header.externalDocumentNumber));
  if (!customerNumbers.length || !externalNumbers.length) {
    return [];
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: companies } = await query.graph({
    entity: "companies",
    fields: ["id", "business_central_customer_number"],
    filters: { business_central_customer_number: customerNumbers },
  });
  if (!companies.length) {
    return [];
  }

  // A superset of the (company, external number) pairs; the match rule picks the exact pair.
  const references = await orderIngestion.listOrderExternalReferences(
    {
      company_id: companies.map((company) => company.id),
      external_order_number: externalNumbers,
    },
    { take: null }
  );
  if (!references.length) {
    return [];
  }

  // Deliberate exemption from data-core-read-workflows: a narrow read of the orders' metadata by
  // id for their current BC order number; the order read workflows load far more than this needs.
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "metadata"],
    filters: { id: unique(references.map((reference) => reference.order_id)) },
  });
  const metadataByOrder = new Map(orders.map((order) => [order.id, order.metadata]));
  const customerNumberByCompany = new Map(
    companies.map((company) => [company.id, company.business_central_customer_number])
  );

  return references.flatMap((reference) =>
    metadataByOrder.has(reference.order_id)
      ? [
          {
            company_id: reference.company_id,
            business_central_customer_number:
              customerNumberByCompany.get(reference.company_id) ?? null,
            order_id: reference.order_id,
            external_order_number: reference.external_order_number,
            bc_state: parseBcIntegrationState(
              metadataByOrder.get(reference.order_id)?.[BC_INTEGRATION_STATE_METADATA_KEY]
            ),
          },
        ]
      : []
  );
}

/**
 * One scan (lead or trail) of flow B for NIMBUS-130: walks count-sized windows from the cursor to
 * the bound. A window holding more than the budget is halved, down to a single timestamp, which is
 * read whole. Each window is read completely, its matched shipments are upserted, and only then
 * does the cursor move to the window's end; a failure or the deadline leaves the cursor at the
 * last complete window. No BC request starts after the deadline.
 *
 * The loop over windows cannot be expressed in workflow composition, so it lives in this step.
 * Nothing is compensated: the upsert is idempotent and the cursor only records completed work.
 */
export const scanShipmentWindowsStep = createStep(
  "scan-shipment-windows",
  async (
    input: ScanShipmentWindowsInput,
    { container }
  ): Promise<StepResponse<ScanShipmentWindowsResult>> => {
    const bc = container.resolve<IBusinessCentralModuleService>(BUSINESS_CENTRAL_MODULE);
    const orderIngestion =
      container.resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);
    const deadline = new Date(input.deadline).getTime();
    const bound = new Date(input.bound);
    const goLiveAt = new Date(input.go_live_at);
    let after = new Date(input.after);
    const result: ScanShipmentWindowsResult = {
      headers: 0,
      matched: 0,
      tracked: 0,
      cursor_at: after.toISOString(),
      complete: false,
      throttled: false,
      retry_after_seconds: null,
    };
    const pastDeadline = () => Date.now() >= deadline;

    if (input.skip) {
      return new StepResponse(result);
    }

    try {
      while (after < bound) {
        let until = bound;
        let count: number;
        for (;;) {
          if (pastDeadline()) {
            return new StepResponse(result);
          }
          count = await bc.countShipments({ after, until });
          const half =
            count > SHIPMENT_WINDOW_HEADER_BUDGET && halveShipmentWindow({ after, until });
          if (!half) {
            break;
          }
          until = half;
        }

        if (count > 0) {
          if (pastDeadline()) {
            return new StepResponse(result);
          }
          const headers = await bc.listShipmentHeaders({ after, until });
          const candidates = await loadOrderCandidates(container, orderIngestion, headers);
          const discoveries = shipmentTrackingForHeaders(headers, candidates, goLiveAt);
          result.headers += headers.length;
          result.matched += discoveries.length;
          if (discoveries.length) {
            const { inserted, updated } = await orderIngestion.upsertShipmentTracking(discoveries);
            result.tracked += inserted + updated;
          }
        }

        await orderIngestion.setShipmentPollCursor(input.cursor, until);
        after = until;
        result.cursor_at = after.toISOString();
      }
    } catch (error) {
      if (!(error instanceof BusinessCentralThrottledError)) {
        throw error;
      }
      result.throttled = true;
      result.retry_after_seconds = error.retryAfterSeconds;
      return new StepResponse(result);
    }

    result.complete = true;
    return new StepResponse(result);
  }
);
