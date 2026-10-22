/**
 * A transfer can be requested only for an order with no customer or a guest customer; an order
 * owned by a customer with an account can neither be blocked nor taken over (NIMBUS-177).
 */
export function canRequestOrderTransfer(owner: { has_account: boolean } | null): boolean {
  return !owner?.has_account;
}
