/**
 * Business Central integration-state contract stored on `Order.metadata`.
 *
 * Ownership note: NIMBUS-149 initializes this object to its pending state when it persists the
 * Medusa order; NIMBUS-148 updates it with the delivery outcome; NIMBUS-158 reads it for the
 * Medusa Admin status/retry widget. This file is the single source of truth for its shape — all
 * three stories import from here rather than restating field names.
 */

export const BC_INTEGRATION_STATE_METADATA_KEY = "business_central_integration";

export type BcIntegrationStatus = "pending" | "sent" | "failed";

export type BcOrderLineFailureReason =
  | "no_identifiers"
  | "not_found"
  | "ambiguous"
  | "rejected_by_bc";

export type BcOrderLineFailure = {
  line_number: number;
  ean_no: string | null;
  item_number: string | null;
  cust_item_no: string | null;
  reason: BcOrderLineFailureReason;
  message: string | null;
};

export type BcIntegrationState = {
  status: BcIntegrationStatus;
  bc_order_id: string | null;
  bc_order_number: string | null;
  attempt_count: number;
  initialized_at: string | null;
  last_attempt_at: string | null;
  sent_at: string | null;
  partial: boolean;
  failure_reason: string | null;
  line_failures: BcOrderLineFailure[];
};

/**
 * The initial, not-yet-sent state. NIMBUS-149 calls this when it creates the Medusa order.
 */
export function createInitialBcIntegrationState(
  initializedAt: string
): BcIntegrationState {
  return {
    status: "pending",
    bc_order_id: null,
    bc_order_number: null,
    attempt_count: 0,
    initialized_at: initializedAt,
    last_attempt_at: null,
    sent_at: null,
    partial: false,
    failure_reason: null,
    line_failures: [],
  };
}

/**
 * The fixed set of values NIMBUS-148 writes to `BcIntegrationState.failure_reason` (the state's
 * field stays `string | null` so older or foreign values still parse). NIMBUS-158 can switch on
 * these. Meanings are documented in Task 04 / PLAN.md.
 */
export type BcSubmissionFailureReason =
  | "canonical_payload_unavailable"
  | "company_unresolved"
  | "bc_customer_number_missing"
  | "bc_customer_lookup_failed"
  | "bc_customer_not_found"
  | "bc_item_lookup_failed"
  | "no_lines_resolved"
  | "bc_submission_failed"
  | "bc_submission_outcome_unknown"
  | "all_lines_rejected_by_bc"
  | "partial_lines_submitted";

const BC_INTEGRATION_STATUSES: readonly BcIntegrationStatus[] = [
  "pending",
  "sent",
  "failed",
];

const BC_ORDER_LINE_FAILURE_REASONS: readonly BcOrderLineFailureReason[] = [
  "no_identifiers",
  "not_found",
  "ambiguous",
  "rejected_by_bc",
];

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseLineFailure(value: unknown): BcOrderLineFailure | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const raw = value as Record<string, unknown>;

  if (typeof raw.line_number !== "number") {
    return null;
  }

  const reason = BC_ORDER_LINE_FAILURE_REASONS.includes(
    raw.reason as BcOrderLineFailureReason
  )
    ? (raw.reason as BcOrderLineFailureReason)
    : "not_found";

  return {
    line_number: raw.line_number,
    ean_no: optionalString(raw.ean_no),
    item_number: optionalString(raw.item_number),
    cust_item_no: optionalString(raw.cust_item_no),
    reason,
    message: optionalString(raw.message),
  };
}

/**
 * Reads an untrusted `Order.metadata[BC_INTEGRATION_STATE_METADATA_KEY]` value into a well-formed
 * state object. Anything missing or malformed falls back to the pending state, so a partially
 * written or absent state can never crash the submission path — an absent state means "never
 * attempted". NIMBUS-158 reads the state through this function too.
 */
export function parseBcIntegrationState(value: unknown): BcIntegrationState {
  if (typeof value !== "object" || value === null) {
    return {
      status: "pending",
      bc_order_id: null,
      bc_order_number: null,
      attempt_count: 0,
      initialized_at: null,
      last_attempt_at: null,
      sent_at: null,
      partial: false,
      failure_reason: null,
      line_failures: [],
    };
  }

  const raw = value as Record<string, unknown>;
  const status = BC_INTEGRATION_STATUSES.includes(raw.status as BcIntegrationStatus)
    ? (raw.status as BcIntegrationStatus)
    : "pending";
  const lineFailures = Array.isArray(raw.line_failures)
    ? raw.line_failures
        .map(parseLineFailure)
        .filter((failure): failure is BcOrderLineFailure => failure !== null)
    : [];

  return {
    status,
    bc_order_id: optionalString(raw.bc_order_id),
    bc_order_number: optionalString(raw.bc_order_number),
    attempt_count:
      typeof raw.attempt_count === "number" && raw.attempt_count >= 0
        ? raw.attempt_count
        : 0,
    initialized_at: optionalString(raw.initialized_at),
    last_attempt_at: optionalString(raw.last_attempt_at),
    sent_at: optionalString(raw.sent_at),
    partial: raw.partial === true,
    failure_reason: optionalString(raw.failure_reason),
    line_failures: lineFailures,
  };
}

/**
 * The duplicate-submission guard. True once a real Business Central sales order exists for this
 * Medusa order — either the last attempt reported `sent`, or a BC order id was recorded at all
 * (which also happens on a `failed` outcome where BC created the header but rejected every line).
 */
export function hasBusinessCentralOrder(state: BcIntegrationState): boolean {
  return state.bc_order_id !== null || state.status === "sent";
}
