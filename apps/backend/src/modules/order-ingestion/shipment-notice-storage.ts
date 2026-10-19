import type { ShipmentNoticePayload, ShipmentNoticeStatus } from "./shipment-notice-contract";
import {
  SHIPMENT_TRACKING_CLOSE_REASONS,
  SHIPMENT_TRACKING_STATES,
} from "./models/shipment-tracking";

export { SHIPMENT_TRACKING_CLOSE_REASONS, SHIPMENT_TRACKING_STATES };

export type ShipmentTrackingState = (typeof SHIPMENT_TRACKING_STATES)[number];
export type ShipmentTrackingCloseReason = (typeof SHIPMENT_TRACKING_CLOSE_REASONS)[number];

/** Key of the single `shipment_notice_state` row. */
export const SHIPMENT_NOTICE_STATE_KEY = "shipment_notices";

export interface ShipmentTrackingReschedule {
  next_check_at: Date;
  attempts: number;
  last_error: string | null;
  last_checked_at: Date | null;
  final_check_done: boolean;
}

export interface ShipmentTrackingClose {
  close_reason: ShipmentTrackingCloseReason;
  attempts: number;
  last_error: string | null;
  last_checked_at: Date | null;
  final_check_done: boolean;
}

/** What the store transaction applies to the tracking row together with `latest_revision`. */
export type ShipmentTrackingSchedule =
  | ({ action: "reschedule" } & ShipmentTrackingReschedule)
  | ({ action: "close" } & ShipmentTrackingClose);

export interface StoreShipmentNoticeInput {
  bc_shipment_id: string;
  /** The latest stored revision the decision was made against; 0 when none was stored. */
  expected_revision: number;
  company_id: string;
  order_id: string;
  external_order_number: string;
  bc_order_number: string;
  shipment_number: string;
  shipment_date: string;
  bc_last_modified_at: Date;
  status: ShipmentNoticeStatus;
  content_hash: string;
  payload: ShipmentNoticePayload;
  tracking: ShipmentTrackingSchedule;
}

export type StoreShipmentNoticeResult =
  | { outcome: "stored"; sequence: number; revision: number }
  | { outcome: "unchanged"; revision: number }
  | { outcome: "conflict"; latest_revision: number };

/** A shipment found by discovery; `next_check_at` is its due time if the row is new. */
export interface ShipmentTrackingDiscovery {
  bc_shipment_id: string;
  shipment_number: string;
  bc_order_number: string;
  posting_date: string;
  company_id: string;
  order_id: string;
  external_order_number: string;
  next_check_at: Date;
  recheck_until: Date;
}

export interface ShipmentTrackingRow {
  id: string;
  bc_shipment_id: string;
  shipment_number: string;
  bc_order_number: string;
  posting_date: string;
  company_id: string;
  order_id: string;
  external_order_number: string;
  latest_revision: number;
  state: ShipmentTrackingState;
  close_reason: ShipmentTrackingCloseReason | null;
  next_check_at: Date;
  recheck_until: Date;
  final_check_done: boolean;
  closed_at: Date | null;
  reopened_at: Date | null;
  reopened_by: string | null;
  attempts: number;
  last_error: string | null;
  last_checked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ShipmentNoticeRow {
  id: string;
  sequence: number;
  previous_sequence: number | null;
  bc_shipment_id: string;
  revision: number;
  status: ShipmentNoticeStatus;
  content_hash: string;
  company_id: string;
  order_id: string;
  external_order_number: string;
  bc_order_number: string;
  shipment_number: string;
  shipment_date: string;
  bc_last_modified_at: Date;
  payload: ShipmentNoticePayload;
  /** Serves as the notice's `recorded_at`. */
  created_at: Date;
}

export interface ShipmentPollState {
  last_sequence: number;
  lead_cursor: Date;
  trail_cursor: Date;
  go_live_at: Date;
  bc_backoff_until: Date | null;
}

export type ShipmentPollCursor = "lead" | "trail";

/** Notices above a cursor (`after: 0` reads from the start), or recorded at or after a time. */
export type CompanyShipmentNoticeQuery = { company_id: string; limit: number } & (
  | { after: number }
  | { since: Date }
);
