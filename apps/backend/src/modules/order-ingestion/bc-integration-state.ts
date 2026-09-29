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
