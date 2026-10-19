import type {
  ShipmentTrackingRow,
  ShipmentTrackingSchedule,
} from "../../../modules/order-ingestion/shipment-notice-storage";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Settling delay before the first check, and the interval between checks while open. */
const CHECK_INTERVAL_MS = 15 * MINUTE;
const RECHECK_WINDOW_DAYS = 14;
/** Back-off after the 1st, 2nd, 3rd and every later consecutive failure. */
const BACKOFF_MS = [15 * MINUTE, HOUR, 4 * HOUR, 6 * HOUR] as const;
const GIVE_UP_AFTER_MS = 3 * DAY;

export type ShipmentScheduleRow = Pick<
  ShipmentTrackingRow,
  | "attempts"
  | "recheck_until"
  | "reopened_at"
  | "final_check_done"
  | "last_error"
  | "last_checked_at"
>;

/**
 * How one check of a tracked shipment ended:
 * - `checked`: read and decided "nothing", or a `shipped`/`revised` revision stored;
 * - `cancelled`: a `cancelled` revision stored;
 * - `superseded`: the order has another current BC order number;
 * - `conflict`: the store found a newer revision than the one decided against;
 * - `failed`: unpairable, or not returned by BC; `error` is a code, never BC text.
 */
export type ShipmentCheckOutcome =
  | { kind: "checked" }
  | { kind: "cancelled" }
  | { kind: "superseded" }
  | { kind: "conflict" }
  | { kind: "failed"; error: string };

/** Due time and re-check window of a shipment found by discovery. */
export function initialShipmentSchedule(header: {
  postingDate: string;
  lastModifiedDateTime: string;
}): { next_check_at: Date; recheck_until: Date } {
  const postingDay = new Date(`${header.postingDate}T00:00:00.000Z`).getTime();
  return {
    next_check_at: new Date(new Date(header.lastModifiedDateTime).getTime() + CHECK_INTERVAL_MS),
    recheck_until: new Date(postingDay + (RECHECK_WINDOW_DAYS + 1) * DAY - 1),
  };
}

/**
 * The tracking row's next state after a check. The first success after the window is the final
 * check, so downtime past the window still gets one last read; failures back off and, once 3 days
 * have passed since the later of the window's end and an Admin reopen with no success, the row
 * gives up.
 */
export function scheduleShipmentCheck(
  row: ShipmentScheduleRow,
  outcome: ShipmentCheckOutcome,
  now: Date
): ShipmentTrackingSchedule {
  const windowEnded = now.getTime() > row.recheck_until.getTime();

  switch (outcome.kind) {
    case "checked":
      return windowEnded
        ? {
            action: "close",
            close_reason: "window_ended",
            attempts: 0,
            last_error: null,
            last_checked_at: now,
            final_check_done: true,
          }
        : {
            action: "reschedule",
            next_check_at: new Date(now.getTime() + CHECK_INTERVAL_MS),
            attempts: 0,
            last_error: null,
            last_checked_at: now,
            final_check_done: false,
          };
    case "cancelled":
    case "superseded":
      return {
        action: "close",
        close_reason: outcome.kind,
        attempts: 0,
        last_error: null,
        last_checked_at: now,
        final_check_done: windowEnded,
      };
    case "conflict":
      return {
        action: "reschedule",
        next_check_at: now,
        attempts: row.attempts,
        last_error: row.last_error,
        last_checked_at: row.last_checked_at,
        final_check_done: row.final_check_done,
      };
    case "failed": {
      const attempts = row.attempts + 1;
      const giveUpFrom =
        Math.max(row.recheck_until.getTime(), row.reopened_at?.getTime() ?? 0) + GIVE_UP_AFTER_MS;
      const failure = {
        attempts,
        last_error: outcome.error,
        last_checked_at: row.last_checked_at,
        final_check_done: row.final_check_done,
      };

      if (now.getTime() >= giveUpFrom) {
        return { action: "close", close_reason: "gave_up", ...failure };
      }

      const backoff = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length) - 1];
      return {
        action: "reschedule",
        next_check_at: new Date(now.getTime() + backoff),
        ...failure,
      };
    }
  }
}
