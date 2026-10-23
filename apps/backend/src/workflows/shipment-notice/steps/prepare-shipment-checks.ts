import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { z } from "@medusajs/framework/zod";
import { ORDER_INGESTION_MODULE } from "../../../modules/order-ingestion";
import {
  BC_INTEGRATION_STATE_METADATA_KEY,
  parseBcIntegrationState,
  type BcOrderLineMapEntry,
} from "../../../modules/order-ingestion/bc-integration-state";
import type OrderIngestionModuleService from "../../../modules/order-ingestion/service";
import {
  isCompanyEnabledForOrderApi,
  ORDER_API_COMPANY_FIELDS,
  type OrderApiCompanyRow,
} from "../../../utils/order-api-access";
import type { LatestShipmentRevision } from "../utils/decide-shipment-notice";

/** At most this many due tracking rows are checked per run, oldest due first. */
export const SHIPMENT_CHECK_BATCH_SIZE = 200;

/**
 * One due tracking row with what its check is decided against. Dates are ISO strings so they
 * survive the workflow's serialisation of step results; nothing here is personal data.
 */
export type DueShipmentCheck = {
  bc_shipment_id: string;
  shipment_number: string;
  bc_order_number: string;
  posting_date: string;
  company_id: string;
  order_id: string;
  external_order_number: string;
  attempts: number;
  last_error: string | null;
  final_check_done: boolean;
  recheck_until: string;
  reopened_at: string | null;
  last_checked_at: string | null;
  /** The latest stored revision: the expected revision of the store. Null when none is stored. */
  expected: LatestShipmentRevision | null;
  /** The order's BC order number now; null when the order or its BC state is gone. */
  current_bc_order_number: string | null;
  bc_lines: BcOrderLineMapEntry[] | null;
  /** The company may use the order API; false when it is switched off or gone. */
  company_enabled: boolean;
};

// Only the listed BC line numbers are needed from a stored payload; other keys are ignored.
const ListedLinesSchema = z.object({
  lines: z.array(z.object({ bc_line_number: z.number().int() })),
});

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

/**
 * Selects the due tracking rows of this run and reads, before any BC read, the latest stored
 * revision of each (NIMBUS-130): a revision another run stores after this read makes the store a
 * conflict instead of overwriting a newer observation. Also reads each row's company setting in
 * one query, so switched-off companies are closed without a BC read (NIMBUS-217).
 */
export const prepareShipmentChecksStep = createStep(
  "prepare-shipment-checks",
  async (
    _input: void,
    { container }
  ): Promise<StepResponse<{ checks: DueShipmentCheck[] }>> => {
    const orderIngestion =
      container.resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);
    const rows = await orderIngestion.listDueShipmentTracking({
      now: new Date(),
      limit: SHIPMENT_CHECK_BATCH_SIZE,
    });
    if (!rows.length) {
      return new StepResponse({ checks: [] });
    }

    const notices = await orderIngestion.listShipmentNotices(
      { bc_shipment_id: rows.map((row) => row.bc_shipment_id) },
      { select: ["bc_shipment_id", "revision", "content_hash", "payload"], take: null }
    );
    const latestByShipment = new Map<string, LatestShipmentRevision>();
    for (const notice of notices) {
      const known = latestByShipment.get(notice.bc_shipment_id);
      if (known && known.revision >= notice.revision) {
        continue;
      }
      latestByShipment.set(notice.bc_shipment_id, {
        revision: notice.revision,
        content_hash: notice.content_hash,
        listed_bc_line_numbers: ListedLinesSchema.parse(notice.payload).lines.map(
          (line) => line.bc_line_number
        ),
      });
    }

    // Deliberate exemption from data-core-read-workflows: a narrow read of the orders' metadata by
    // id for their current BC order number and line map; the order read workflows load far more.
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { id: [...new Set(rows.map((row) => row.order_id))] },
    });
    const stateByOrder = new Map(
      orders.map((order) => [
        order.id,
        parseBcIntegrationState(order.metadata?.[BC_INTEGRATION_STATE_METADATA_KEY]),
      ])
    );

    const { data: companies } = await query.graph({
      entity: "companies",
      fields: [...ORDER_API_COMPANY_FIELDS],
      filters: { id: [...new Set(rows.map((row) => row.company_id))] },
    });
    const companyById = new Map(
      companies.map((company: OrderApiCompanyRow) => [company.id, company])
    );

    const checks = rows.map((row): DueShipmentCheck => {
      const state = stateByOrder.get(row.order_id);
      return {
        bc_shipment_id: row.bc_shipment_id,
        shipment_number: row.shipment_number,
        bc_order_number: row.bc_order_number,
        posting_date: row.posting_date,
        company_id: row.company_id,
        order_id: row.order_id,
        external_order_number: row.external_order_number,
        attempts: Number(row.attempts),
        last_error: row.last_error,
        final_check_done: row.final_check_done,
        recheck_until: row.recheck_until.toISOString(),
        reopened_at: iso(row.reopened_at),
        last_checked_at: iso(row.last_checked_at),
        expected: latestByShipment.get(row.bc_shipment_id) ?? null,
        current_bc_order_number: state?.bc_order_number ?? null,
        bc_lines: state?.bc_lines ?? null,
        company_enabled: isCompanyEnabledForOrderApi(companyById.get(row.company_id)),
      };
    });

    return new StepResponse({ checks });
  }
);
