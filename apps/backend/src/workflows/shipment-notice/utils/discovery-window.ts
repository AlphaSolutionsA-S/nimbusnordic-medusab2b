import type { BCShipmentHeader, BCShipmentWindow } from "../../../modules/business-central/types";
import type {
  ShipmentTrackingDiscovery,
} from "../../../modules/order-ingestion/shipment-notice-storage";
import { matchShipmentToOrder, type ShipmentOrderCandidate } from "./match-shipment-order";
import { initialShipmentSchedule } from "./shipment-check-schedule";

const MINUTE = 60 * 1000;

/** Headers modified this recently may still change; the lead scan stops short of them. */
export const SHIPMENT_SETTLING_MS = 15 * MINUTE;
/** The trail scan re-reads behind the lead scan for headers BC made visible late. */
export const SHIPMENT_TRAIL_LAG_MS = 30 * MINUTE;
/** Most headers one window may hold; a larger window is halved (a single timestamp never is). */
export const SHIPMENT_WINDOW_HEADER_BUDGET = 1000;
/** Shortest back-off after BC throttles, whatever its Retry-After says. */
export const SHIPMENT_MIN_BACKOFF_SECONDS = 60;

/** Where the lead and trail scans stop in a run that started at `now`. */
export function shipmentScanBounds(now: Date): { lead: Date; trail: Date } {
  const lead = now.getTime() - SHIPMENT_SETTLING_MS;
  return { lead: new Date(lead), trail: new Date(lead - SHIPMENT_TRAIL_LAG_MS) };
}

/**
 * The end of the lower half of a window that holds too many headers, or null when the window is a
 * single timestamp (1 ms, BC's precision) and must be read whole.
 */
export function halveShipmentWindow(window: BCShipmentWindow): Date | null {
  const width = window.until.getTime() - window.after.getTime();
  if (width <= 1) {
    return null;
  }
  return new Date(window.after.getTime() + Math.floor(width / 2));
}

/** A tracking row for every header that belongs to an API order (NIMBUS-130). */
export function shipmentTrackingForHeaders(
  headers: readonly BCShipmentHeader[],
  candidates: readonly ShipmentOrderCandidate[],
  goLiveAt: Date
): ShipmentTrackingDiscovery[] {
  const discoveries: ShipmentTrackingDiscovery[] = [];

  for (const header of headers) {
    const order = matchShipmentToOrder(header, candidates, goLiveAt);
    // A match implies both are set; the checks only narrow the types.
    if (!order || header.orderNumber === null || header.postingDate === null) {
      continue;
    }
    discoveries.push({
      bc_shipment_id: header.id,
      shipment_number: header.number,
      bc_order_number: header.orderNumber,
      posting_date: header.postingDate,
      company_id: order.company_id,
      order_id: order.order_id,
      external_order_number: order.external_order_number,
      ...initialShipmentSchedule({
        postingDate: header.postingDate,
        lastModifiedDateTime: header.lastModifiedDateTime,
      }),
    });
  }

  return discoveries;
}
