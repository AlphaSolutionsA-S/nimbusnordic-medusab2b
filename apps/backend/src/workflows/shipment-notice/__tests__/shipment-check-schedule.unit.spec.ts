import {
  initialShipmentSchedule,
  scheduleShipmentCheck,
  type ShipmentCheckOutcome,
  type ShipmentScheduleRow,
} from "../utils/shipment-check-schedule";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Posted 2026-10-01: the 14-day window ends at the end of 2026-10-15 (UTC).
const WINDOW_END = new Date("2026-10-15T23:59:59.999Z");
const POSTED = new Date("2026-10-01T00:00:00.000Z");

function day(n: number, hours = 12): Date {
  return new Date(POSTED.getTime() + n * DAY + hours * HOUR);
}

const openRow: ShipmentScheduleRow = {
  attempts: 0,
  recheck_until: WINDOW_END,
  reopened_at: null,
  final_check_done: false,
  last_error: null,
  last_checked_at: null,
};

const checked: ShipmentCheckOutcome = { kind: "checked" };
const failed: ShipmentCheckOutcome = { kind: "failed", error: "unpairable" };

describe("initialShipmentSchedule", () => {
  it("is due 15 minutes after the last change and re-checked to the end of posting day + 14 (UTC)", () => {
    expect(
      initialShipmentSchedule({
        postingDate: "2026-10-01",
        lastModifiedDateTime: "2026-10-01T13:05:00Z",
      })
    ).toEqual({
      next_check_at: new Date("2026-10-01T13:20:00.000Z"),
      recheck_until: WINDOW_END,
    });
  });
});

describe("scheduleShipmentCheck", () => {
  it("re-checks in 15 minutes after a successful check inside the window", () => {
    const now = day(3);
    expect(scheduleShipmentCheck({ ...openRow, attempts: 2, last_error: "x" }, checked, now)).toEqual({
      action: "reschedule",
      next_check_at: new Date(now.getTime() + 15 * MINUTE),
      attempts: 0,
      last_error: null,
      last_checked_at: now,
      final_check_done: false,
    });
  });

  it("closes window_ended on the first successful check after the window", () => {
    const now = day(15, 25);
    expect(scheduleShipmentCheck(openRow, checked, now)).toEqual({
      action: "close",
      close_reason: "window_ended",
      attempts: 0,
      last_error: null,
      last_checked_at: now,
      final_check_done: true,
    });
  });

  it("closes cancelled when the check recorded a cancellation", () => {
    const now = day(2);
    expect(scheduleShipmentCheck(openRow, { kind: "cancelled" }, now)).toEqual({
      action: "close",
      close_reason: "cancelled",
      attempts: 0,
      last_error: null,
      last_checked_at: now,
      final_check_done: false,
    });
  });

  it("closes superseded when the order has a newer BC order number", () => {
    const now = day(2);
    expect(scheduleShipmentCheck(openRow, { kind: "superseded" }, now)).toMatchObject({
      action: "close",
      close_reason: "superseded",
      last_checked_at: now,
    });
  });

  it("is due again at once after a store conflict, without counting a failure", () => {
    const now = day(2);
    const row = { ...openRow, attempts: 1, last_error: "not_returned", last_checked_at: day(1) };
    expect(scheduleShipmentCheck(row, { kind: "conflict" }, now)).toEqual({
      action: "reschedule",
      next_check_at: now,
      attempts: 1,
      last_error: "not_returned",
      last_checked_at: day(1),
      final_check_done: false,
    });
  });

  it.each([
    [0, 15 * MINUTE],
    [1, HOUR],
    [2, 4 * HOUR],
    [3, 6 * HOUR],
    [10, 6 * HOUR],
  ])("backs off after a failure with %i earlier failures by %i ms", (attempts, delay) => {
    const now = day(4);
    const row = { ...openRow, attempts, last_checked_at: day(3) };
    expect(scheduleShipmentCheck(row, failed, now)).toEqual({
      action: "reschedule",
      next_check_at: new Date(now.getTime() + delay),
      attempts: attempts + 1,
      last_error: "unpairable",
      last_checked_at: day(3),
      final_check_done: false,
    });
  });

  it("keeps backing off after the window until 3 days have passed without success", () => {
    const justBefore = new Date(WINDOW_END.getTime() + 3 * DAY - 1);
    expect(scheduleShipmentCheck({ ...openRow, attempts: 5 }, failed, justBefore).action).toBe(
      "reschedule"
    );
  });

  it("closes gave_up after a failure 3 days past the window's end", () => {
    const now = new Date(WINDOW_END.getTime() + 3 * DAY);
    expect(scheduleShipmentCheck({ ...openRow, attempts: 5 }, failed, now)).toEqual({
      action: "close",
      close_reason: "gave_up",
      attempts: 6,
      last_error: "unpairable",
      last_checked_at: null,
      final_check_done: false,
    });
  });

  it("counts the 3 days from the reopen time when the row was reopened after the window", () => {
    const reopened = { ...openRow, reopened_at: day(30) };
    expect(scheduleShipmentCheck(reopened, failed, day(32)).action).toBe("reschedule");
    expect(scheduleShipmentCheck(reopened, failed, day(33)).action).toBe("close");
    expect(scheduleShipmentCheck(reopened, checked, day(31))).toMatchObject({
      action: "close",
      close_reason: "window_ended",
      final_check_done: true,
    });
  });

  it("still runs a final check after downtime past the window", () => {
    // Checked on day 12, then down until day 15 + 1 h after the window ended.
    const afterDay12 = scheduleShipmentCheck(openRow, checked, day(12));
    expect(afterDay12.action).toBe("reschedule");

    const back = new Date(WINDOW_END.getTime() + HOUR);
    const rowAfterDowntime = { ...openRow, last_checked_at: day(12) };

    // A failure on return backs off rather than giving up, so the final check still happens.
    expect(scheduleShipmentCheck(rowAfterDowntime, failed, back).action).toBe("reschedule");
    // The next success, with or without a recorded revision, is the final check.
    expect(scheduleShipmentCheck(rowAfterDowntime, checked, back)).toMatchObject({
      action: "close",
      close_reason: "window_ended",
      final_check_done: true,
    });
  });

  it("backs off on repeated failures and gives up 3 days after the window with no success", () => {
    let row: ShipmentScheduleRow = { ...openRow };
    let now = day(13);
    const delays: number[] = [];

    for (let i = 0; i < 100; i++) {
      const next = scheduleShipmentCheck(row, failed, now);
      if (next.action === "close") {
        expect(next.close_reason).toBe("gave_up");
        expect(now.getTime()).toBeGreaterThanOrEqual(WINDOW_END.getTime() + 3 * DAY);
        expect(delays.slice(0, 5)).toEqual([15 * MINUTE, HOUR, 4 * HOUR, 6 * HOUR, 6 * HOUR]);
        return;
      }
      delays.push(next.next_check_at.getTime() - now.getTime());
      row = { ...row, attempts: next.attempts, last_error: next.last_error };
      now = next.next_check_at;
    }
    throw new Error("never gave up");
  });
});
