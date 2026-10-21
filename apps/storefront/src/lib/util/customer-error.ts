// Stable code for "the customer's cart could not be resolved". Thrown or
// returned by lib/data/cart.ts; mapped to Common.errors.cartNotFound.
export const CART_NOT_FOUND_ERROR = "CART_NOT_FOUND"

// Stable code for "carts need a signed-in customer" (the backend refuses cart
// creation without a token). Returned by the add-to-cart actions; mapped to
// Common.errors.signInRequired.
export const SIGN_IN_REQUIRED_ERROR = "SIGN_IN_REQUIRED"

// Stable code for "the backend refused this cart" (404 for a cart the caller
// may not use, e.g. a cookie left by another account). Mapped to
// Common.errors.cartUnavailable.
export const CART_UNAVAILABLE_ERROR = "CART_UNAVAILABLE"

// Keys of the `Common.errors` catalog namespace.
export type CustomerErrorKey =
  | "generic"
  | "cartNotFound"
  | "signInRequired"
  | "cartUnavailable"

const ERROR_KEYS: ReadonlyArray<readonly [string, CustomerErrorKey]> = [
  [CART_NOT_FOUND_ERROR, "cartNotFound"],
  [SIGN_IN_REQUIRED_ERROR, "signInRequired"],
  [CART_UNAVAILABLE_ERROR, "cartUnavailable"],
]

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return typeof error === "string" ? error : ""
}

export function getCustomerErrorKey(error: unknown): CustomerErrorKey {
  const message = getErrorMessage(error)
  return ERROR_KEYS.find(([code]) => message.includes(code))?.[1] ?? "generic"
}

// Diagnostics only — the raw message never reaches the customer. Logs the
// message string alone (no error object, request or form data) to keep PII
// out of the logs.
export function logCustomerError(context: string, error: unknown): void {
  console.error("[customer-error]", { context, message: getErrorMessage(error) })
}
