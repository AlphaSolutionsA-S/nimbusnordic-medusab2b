import type { BCShipmentHeader } from "../../../modules/business-central/types";
import type { BcIntegrationState } from "../../../modules/order-ingestion/bc-integration-state";

/** An API order (`order_external_reference`) a BC shipment header may belong to. */
export interface ShipmentOrderCandidate {
  company_id: string;
  /** The company's `business_central_customer_number`. */
  business_central_customer_number: string | null;
  order_id: string;
  external_order_number: string;
  bc_state: Pick<BcIntegrationState, "bc_order_number">;
}

/**
 * A shipment belongs to the order only under the order's current BC order number, so shipments
 * of an order number replaced by a force resend are neither matched nor checked again.
 */
export function isCurrentBcOrder(
  bcOrderNumber: string | null,
  state: Pick<BcIntegrationState, "bc_order_number">
): boolean {
  return bcOrderNumber !== null && state.bc_order_number === bcOrderNumber;
}

/**
 * The API order a posted shipment belongs to, or null. The company is the one whose BC
 * customer number is the shipment's, the order is that company's order with the shipment's external
 * document number, and the order's current BC order number must be the shipment's. Shipments
 * posted before the go-live day (UTC) are never matched (no back-fill).
 */
export function matchShipmentToOrder<T extends ShipmentOrderCandidate>(
  header: BCShipmentHeader,
  candidates: readonly T[],
  goLiveAt: Date
): T | null {
  const goLiveDay = goLiveAt.toISOString().slice(0, 10);

  if (
    header.customerNumber === null ||
    header.externalDocumentNumber === null ||
    header.postingDate === null ||
    header.postingDate < goLiveDay
  ) {
    return null;
  }

  return (
    candidates.find(
      (candidate) =>
        candidate.business_central_customer_number === header.customerNumber &&
        candidate.external_order_number === header.externalDocumentNumber &&
        isCurrentBcOrder(header.orderNumber, candidate.bc_state)
    ) ?? null
  );
}
