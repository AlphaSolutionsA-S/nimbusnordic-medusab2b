import { createInitialBcIntegrationState } from "../bc-integration-state";

describe("createInitialBcIntegrationState", () => {
  it("TC-1: starts pending with a zero attempt count and no BC order", () => {
    const state = createInitialBcIntegrationState("2026-09-29T10:00:00.000Z");

    expect(state).toEqual({
      status: "pending",
      bc_order_id: null,
      bc_order_number: null,
      attempt_count: 0,
      initialized_at: "2026-09-29T10:00:00.000Z",
      last_attempt_at: null,
      sent_at: null,
      partial: false,
      failure_reason: null,
      line_failures: [],
    });
  });
});
