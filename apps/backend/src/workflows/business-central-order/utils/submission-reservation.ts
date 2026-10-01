export const ADMIN_BC_SUBMISSION_REQUESTED_EVENT =
  "order_ingestion.admin_bc_submission_requested";
export const BC_SUBMISSION_RESERVATION_TTL = 3600;
export function getBcSubmissionReservationKey(orderId: string): string {
  return `bc-submission-${orderId}`;
}
export const BC_SUBMISSION_RESERVATION_RENEWAL_MS =
  (BC_SUBMISSION_RESERVATION_TTL * 1000) / 3;
