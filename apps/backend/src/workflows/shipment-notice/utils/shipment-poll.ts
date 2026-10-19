const MINUTE_MS = 60 * 1000;

/** No new BC request starts later than this after a poll run starts (NIMBUS-130). */
export const SHIPMENT_POLL_RUN_DEADLINE_MS = 4 * MINUTE_MS;

/** Lead lag or due-check age beyond this means the poll is not keeping up. */
export const SHIPMENT_POLL_STALL_MS = 60 * MINUTE_MS;

/** What one poll run did, as the poll job logs it. */
export type ShipmentPollSummary = {
  /** The run was skipped because BC throttling set a back-off that is still in force. */
  backed_off: boolean;
  headers: number;
  matched: number;
  /** Null when discovery did not run. */
  lead_lag_ms: number | null;
  trail_lag_ms: number | null;
  checked: number;
  recorded: number;
  unchanged: number;
  conflicts: number;
  errors: number;
  /** Null when the checks did not run. */
  backlog_due: number | null;
  oldest_due_age_ms: number | null;
};

export function isShipmentPollBackedOff(backoffUntil: Date | null, now: Date): boolean {
  return backoffUntil !== null && backoffUntil.getTime() > now.getTime();
}

export function shipmentPollDeadline(startedAt: Date): Date {
  return new Date(startedAt.getTime() + SHIPMENT_POLL_RUN_DEADLINE_MS);
}

const minutes = (ms: number | null): string =>
  ms === null ? "n/a" : (ms / MINUTE_MS).toFixed(1);

/** The run's summary line (counts only) and its stalled-progress warnings. */
export function shipmentPollLogLines(
  summary: ShipmentPollSummary,
  durationMs: number
): { summary: string; warnings: string[] } {
  if (summary.backed_off) {
    return {
      summary: "Shipment notice poll skipped: Business Central back-off in force",
      warnings: [],
    };
  }

  const line =
    `Shipment notice poll: duration_ms=${durationMs} headers=${summary.headers} ` +
    `matched=${summary.matched} checked=${summary.checked} recorded=${summary.recorded} ` +
    `unchanged=${summary.unchanged} conflicts=${summary.conflicts} errors=${summary.errors} ` +
    `lead_lag_min=${minutes(summary.lead_lag_ms)} trail_lag_min=${minutes(summary.trail_lag_ms)} ` +
    `backlog_due=${summary.backlog_due ?? "n/a"} ` +
    `oldest_due_age_min=${minutes(summary.oldest_due_age_ms)}`;

  const limit = SHIPMENT_POLL_STALL_MS / MINUTE_MS;
  const warnings: string[] = [];
  if (summary.lead_lag_ms !== null && summary.lead_lag_ms > SHIPMENT_POLL_STALL_MS) {
    warnings.push(
      `Shipment notice poll stalled: the lead scan is ${minutes(summary.lead_lag_ms)} minutes ` +
        `behind (limit ${limit})`
    );
  }
  if (summary.oldest_due_age_ms !== null && summary.oldest_due_age_ms > SHIPMENT_POLL_STALL_MS) {
    warnings.push(
      `Shipment notice poll stalled: the oldest due shipment check has waited ` +
        `${minutes(summary.oldest_due_age_ms)} minutes (limit ${limit})`
    );
  }

  return { summary: line, warnings };
}
