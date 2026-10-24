import {
  createInitialBcIntegrationState,
  hasBusinessCentralOrder,
  parseBcIntegrationState,
} from "../bc-integration-state";
import type { BcIntegrationState } from "../bc-integration-state";

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
      bc_lines: null,
    });
  });
});

describe("parseBcIntegrationState", () => {
  it("TC-2: round-trips a well-formed state including line failures", () => {
    const state: BcIntegrationState = {
      status: "sent",
      bc_order_id: "11111111-1111-1111-1111-111111111111",
      bc_order_number: "SO-001234",
      attempt_count: 2,
      initialized_at: "2026-09-29T10:00:00.000Z",
      last_attempt_at: "2026-09-29T10:05:00.000Z",
      sent_at: "2026-09-29T10:05:00.000Z",
      partial: true,
      failure_reason: "partial_lines_submitted",
      line_failures: [
        {
          line_number: 2,
          ean_no: "5712094143635",
          item_number: "NKT-NIM-TELLURIDENA-M",
          cust_item_no: null,
          reason: "not_found",
          message: null,
        },
      ],
      bc_lines: [
        { line_number: 1, ean_no: "5712094143628", bc_sequence: 10000 },
        { line_number: 3, ean_no: null, bc_sequence: null },
      ],
    };

    expect(parseBcIntegrationState(state)).toEqual(state);
  });

  it("TC-3: falls back to the pending state for absent or malformed input", () => {
    const inputs: unknown[] = [
      undefined,
      null,
      "nope",
      { status: "exploded", attempt_count: -5, bc_order_id: 7 },
    ];

    for (const input of inputs) {
      const parsed = parseBcIntegrationState(input);

      expect(parsed.status).toEqual("pending");
      expect(parsed.attempt_count).toEqual(0);
      expect(parsed.bc_order_id).toBeNull();
      expect(parsed.line_failures).toEqual([]);
    }
  });

  it("TC-4: keeps usable line failures and drops malformed ones", () => {
    const parsed = parseBcIntegrationState({
      status: "failed",
      line_failures: [
        {
          line_number: 1,
          ean_no: "5712094145752",
          item_number: "FLS-NIM-VESPERMNA-XL",
          cust_item_no: "FLS-NIM-VESPERMNA-XL",
          reason: "ambiguous",
          message: null,
        },
        null,
        { reason: "not_found" },
        { line_number: 3, reason: "who-knows" },
      ],
    });

    expect(parsed.status).toEqual("failed");
    expect(parsed.line_failures).toHaveLength(2);
    expect(parsed.line_failures[0].reason).toEqual("ambiguous");
    expect(parsed.line_failures[1]).toEqual({
      line_number: 3,
      ean_no: null,
      item_number: null,
      cust_item_no: null,
      reason: "not_found",
      message: null,
    });
  });

  it("keeps the size and unit refusal reasons", () => {
    const parsed = parseBcIntegrationState({
      status: "sent",
      line_failures: [
        { line_number: 1, reason: "size_unresolved" },
        { line_number: 2, reason: "unit_mismatch" },
      ],
    });

    expect(parsed.line_failures.map((failure) => failure.reason)).toEqual([
      "size_unresolved",
      "unit_mismatch",
    ]);
  });

  it("reads a state written before the line map existed as having no line map", () => {
    const parsed = parseBcIntegrationState({
      status: "sent",
      bc_order_id: "bc-1",
      bc_order_number: "SO-001234",
      line_failures: [],
    });

    expect(parsed.bc_order_number).toEqual("SO-001234");
    expect(parsed.bc_lines).toBeNull();
    expect(parseBcIntegrationState({ status: "sent", bc_lines: "nope" }).bc_lines).toBeNull();
    expect(parseBcIntegrationState(undefined).bc_lines).toBeNull();
  });

  it("keeps usable line-map entries and drops malformed ones", () => {
    const parsed = parseBcIntegrationState({
      status: "sent",
      bc_lines: [
        { line_number: 1, ean_no: "5712094143628", bc_sequence: 10000 },
        null,
        { ean_no: "5712094143635", bc_sequence: 20000 },
        { line_number: "2", ean_no: "5712094143635", bc_sequence: 20000 },
        { line_number: 4, ean_no: 42, bc_sequence: "30000" },
      ],
    });

    expect(parsed.bc_lines).toEqual([
      { line_number: 1, ean_no: "5712094143628", bc_sequence: 10000 },
      { line_number: 4, ean_no: null, bc_sequence: null },
    ]);
  });
});

describe("hasBusinessCentralOrder", () => {
  it("accepts untracked Admin state and still recognizes a recorded BC identity", () => {
    expect(hasBusinessCentralOrder({ status: null, bc_order_id: null })).toBe(
      false
    );
    expect(hasBusinessCentralOrder({ status: null, bc_order_id: "bc-1" })).toBe(
      true
    );
  });

  it("TC-5: reports an existing BC order from either the id or a sent status", () => {
    const base = createInitialBcIntegrationState("2026-09-29T10:00:00.000Z");

    expect(hasBusinessCentralOrder(base)).toBe(false);
    expect(
      hasBusinessCentralOrder({ ...base, status: "sent", bc_order_id: "bc-1" })
    ).toBe(true);
    expect(hasBusinessCentralOrder({ ...base, status: "sent" })).toBe(true);
    expect(
      hasBusinessCentralOrder({ ...base, status: "failed", bc_order_id: "bc-1" })
    ).toBe(true);
  });
});
