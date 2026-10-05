import {
  hasBusinessCentralOrder,
  parseBcIntegrationState,
} from "../../../modules/order-ingestion/bc-integration-state";
import type {
  BcIntegrationState,
  BcOrderLineFailureReason,
} from "../../../modules/order-ingestion/bc-integration-state";

const FAILURE_REASONS = new Set([
  "canonical_payload_unavailable",
  "company_unresolved",
  "bc_customer_number_missing",
  "bc_customer_lookup_failed",
  "bc_customer_not_found",
  "bc_item_lookup_failed",
  "no_lines_resolved",
  "bc_submission_failed",
  "bc_submission_outcome_unknown",
  "all_lines_rejected_by_bc",
  "partial_lines_submitted",
]);
export type AdminBcIntegration = Omit<
  BcIntegrationState,
  "status" | "line_failures"
> & {
  status: BcIntegrationState["status"] | null;
  line_failures: { line_number: number; reason: BcOrderLineFailureReason }[];
};
export function toAdminBcIntegration(value: unknown): AdminBcIntegration {
  const state = parseBcIntegrationState(value);
  return {
    status: value === undefined || value === null ? null : state.status,
    bc_order_id: state.bc_order_id,
    bc_order_number: state.bc_order_number,
    attempt_count: state.attempt_count,
    initialized_at: state.initialized_at,
    last_attempt_at: state.last_attempt_at,
    sent_at: state.sent_at,
    partial: state.partial,
    failure_reason:
      state.failure_reason && FAILURE_REASONS.has(state.failure_reason)
        ? state.failure_reason
        : null,
    line_failures: state.line_failures.map(({ line_number, reason }) => ({
      line_number,
      reason,
    })),
  };
}
export function shouldSkipBcSubmission(
  state: BcIntegrationState,
  forceResend = false
): boolean {
  return !forceResend && hasBusinessCentralOrder(state);
}
