import {
  toAdminBcIntegration,
  shouldSkipBcSubmission,
} from "../utils/admin-bc-integration";
import { createInitialBcIntegrationState } from "../../../modules/order-ingestion/bc-integration-state";

describe("Admin BC integration contract", () => {
  it("returns null status for untracked orders", () => {
    expect(toAdminBcIntegration(undefined)).toMatchObject({
      status: null,
      attempt_count: 0,
      line_failures: [],
    });
  });
  it("whitelists failure codes and drops vendor messages and canonical data", () => {
    const state = {
      ...createInitialBcIntegrationState("2026-10-01T00:00:00.000Z"),
      status: "failed",
      failure_reason: "secret token",
      line_failures: [
        {
          line_number: 1,
          reason: "rejected_by_bc",
          message: "token secret",
          ean_no: "personal",
          item_number: "sku",
          cust_item_no: "customer",
        },
      ],
    };
    const result = toAdminBcIntegration(state);
    expect(result.failure_reason).toBeNull();
    expect(result.line_failures).toEqual([
      { line_number: 1, reason: "rejected_by_bc" },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/secret|personal|customer/);
  });
  it("keeps ordinary retries duplicate-safe when a BC id exists even on failure", () => {
    const state = {
      ...createInitialBcIntegrationState("2026-10-01T00:00:00.000Z"),
      bc_order_id: "bc_123",
    };
    expect(shouldSkipBcSubmission(state)).toBe(true);
    expect(shouldSkipBcSubmission(state, false)).toBe(true);
    expect(shouldSkipBcSubmission(state, true)).toBe(false);
  });
  it("guards a sent state without an identifier and allows a failed retry without one", () => {
    const pending = createInitialBcIntegrationState("2026-10-01T00:00:00.000Z");
    expect(shouldSkipBcSubmission({ ...pending, status: "sent" })).toBe(true);
    expect(shouldSkipBcSubmission({ ...pending, status: "failed" })).toBe(
      false
    );
  });
});
