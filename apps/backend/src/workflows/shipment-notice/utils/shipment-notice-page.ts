import type {
  ShipmentNotice,
  ShipmentNoticeEnvelope,
} from "../../../modules/order-ingestion/shipment-notice-contract";
import type {
  CompanyShipmentNoticeQuery,
  ShipmentNoticeRow,
} from "../../../modules/order-ingestion/shipment-notice-storage";

/** The largest value of the int4 `sequence` column. */
const MAX_STORED_SEQUENCE = 2_147_483_647;

export type ShipmentNoticeReadRequest = {
  company_id: string;
  limit: number;
  /** A validated decimal cursor, or null. */
  after: string | null;
  /** A validated ISO 8601 timestamp, or null; never sent together with `after`. */
  since: string | null;
};

/**
 * The listing a read request asks for: above `after`, from `since`, or from the start. The wire
 * accepts cursors up to 15 digits while `sequence` is an int4, so a larger cursor is capped (no row
 * lies above it either way) rather than failing the query with an out-of-range error.
 */
export function companyShipmentNoticeQuery(
  request: ShipmentNoticeReadRequest
): CompanyShipmentNoticeQuery {
  const { company_id, limit } = request;
  if (request.since !== null) {
    return { company_id, limit, since: new Date(request.since) };
  }
  const after = request.after === null ? 0 : Number(request.after);
  return { company_id, limit, after: Math.min(after, MAX_STORED_SEQUENCE) };
}

function toShipmentNotice(row: ShipmentNoticeRow): ShipmentNotice {
  return {
    cursor: String(row.sequence),
    previous_cursor: row.previous_sequence === null ? null : String(row.previous_sequence),
    recorded_at: row.created_at.toISOString(),
    revision: row.revision,
    status: row.status,
    ...row.payload,
    // Lines stored before NIMBUS-231 lack the key; the contract always carries it.
    lines: row.payload.lines.map((line) => ({ ...line, variant_code: line.variant_code ?? null })),
  };
}

/**
 * One page of the envelope from the `limit + 1` rows read: the extra row only sets `has_more`. An
 * empty page echoes `after` so the caller can always store the cursor it gets back.
 */
export function shipmentNoticePage(
  rows: readonly ShipmentNoticeRow[],
  page: { limit: number; after: string | null }
): ShipmentNoticeEnvelope {
  const notices = rows.slice(0, page.limit).map(toShipmentNotice);
  const last = notices[notices.length - 1];
  return {
    shipment_notices: notices,
    next_cursor: last ? last.cursor : page.after,
    has_more: rows.length > page.limit,
  };
}
