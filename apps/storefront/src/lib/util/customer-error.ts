// Stable code for "the customer's cart could not be resolved". Thrown or
// returned by lib/data/cart.ts; mapped to Common.errors.cartNotFound.
export const CART_NOT_FOUND_ERROR = "CART_NOT_FOUND"

// Keys of the `Common.errors` catalog namespace.
export type CustomerErrorKey = "generic" | "cartNotFound"

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return typeof error === "string" ? error : ""
}

export function getCustomerErrorKey(error: unknown): CustomerErrorKey {
  return getErrorMessage(error).includes(CART_NOT_FOUND_ERROR)
    ? "cartNotFound"
    : "generic"
}

// Diagnostics only — the raw message never reaches the customer. Logs the
// message string alone (no error object, request or form data) to keep PII
// out of the logs.
export function logCustomerError(context: string, error: unknown): void {
  console.error("[customer-error]", { context, message: getErrorMessage(error) })
}
