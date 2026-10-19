import {
  isShipmentPollBackedOff,
  shipmentPollDeadline,
  shipmentPollLogLines,
  type ShipmentPollSummary,
} from "../utils/shipment-poll";

const NOW = new Date("2026-10-21T12:00:00.000Z");
const MINUTE = 60 * 1000;

const ran: ShipmentPollSummary = {
  backed_off: false,
  headers: 12,
  matched: 3,
  lead_lag_ms: 15.5 * MINUTE,
  trail_lag_ms: 45 * MINUTE,
  checked: 4,
  recorded: 2,
  unchanged: 1,
  conflicts: 0,
  errors: 1,
  backlog_due: 7,
  oldest_due_age_ms: 3 * MINUTE,
};

describe("isShipmentPollBackedOff", () => {
  it("is backed off while the back-off ends in the future", () => {
    expect(isShipmentPollBackedOff(new Date(NOW.getTime() + 1), NOW)).toBe(true);
  });

  it("runs once the back-off has ended, or when there is none", () => {
    expect(isShipmentPollBackedOff(NOW, NOW)).toBe(false);
    expect(isShipmentPollBackedOff(new Date(NOW.getTime() - MINUTE), NOW)).toBe(false);
    expect(isShipmentPollBackedOff(null, NOW)).toBe(false);
  });
});

describe("shipmentPollDeadline", () => {
  it("ends the run's BC work four minutes after it starts", () => {
    expect(shipmentPollDeadline(NOW)).toEqual(new Date("2026-10-21T12:04:00.000Z"));
  });
});

describe("shipmentPollLogLines", () => {
  it("summarises a run with every count, the lags and the backlog", () => {
    const { summary, warnings } = shipmentPollLogLines(ran, 1234);

    expect(summary).toBe(
      "Shipment notice poll: duration_ms=1234 headers=12 matched=3 checked=4 recorded=2 " +
        "unchanged=1 conflicts=0 errors=1 lead_lag_min=15.5 trail_lag_min=45.0 backlog_due=7 " +
        "oldest_due_age_min=3.0"
    );
    expect(warnings).toEqual([]);
  });

  it("marks values a run did not measure", () => {
    const { summary } = shipmentPollLogLines(
      { ...ran, checked: 0, backlog_due: null, oldest_due_age_ms: null },
      10
    );

    expect(summary).toContain("backlog_due=n/a oldest_due_age_min=n/a");
  });

  it("warns when the lead scan lags more than 60 minutes", () => {
    const { warnings } = shipmentPollLogLines({ ...ran, lead_lag_ms: 61 * MINUTE }, 10);

    expect(warnings).toEqual([
      "Shipment notice poll stalled: the lead scan is 61.0 minutes behind (limit 60)",
    ]);
  });

  it("warns when the oldest due check has waited more than 60 minutes", () => {
    const { warnings } = shipmentPollLogLines({ ...ran, oldest_due_age_ms: 90 * MINUTE }, 10);

    expect(warnings).toEqual([
      "Shipment notice poll stalled: the oldest due shipment check has waited 90.0 minutes " +
        "(limit 60)",
    ]);
  });

  it("does not warn at exactly 60 minutes", () => {
    const { warnings } = shipmentPollLogLines(
      { ...ran, lead_lag_ms: 60 * MINUTE, oldest_due_age_ms: 60 * MINUTE },
      10
    );

    expect(warnings).toEqual([]);
  });

  it("logs only the skip for a run skipped by the BC back-off", () => {
    const skipped: ShipmentPollSummary = {
      ...ran,
      backed_off: true,
      lead_lag_ms: null,
      trail_lag_ms: null,
      backlog_due: null,
      oldest_due_age_ms: null,
    };

    expect(shipmentPollLogLines(skipped, 5)).toEqual({
      summary: "Shipment notice poll skipped: Business Central back-off in force",
      warnings: [],
    });
  });
});
