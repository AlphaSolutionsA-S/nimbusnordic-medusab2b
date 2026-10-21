import type { CartLookup } from "@/lib/data/cart"

// The cookie cart must be one the signed-in customer owns. A company
// administrator can read a colleague's cart under admin approval, but every
// cart mutation is owner-only, so such a cart is treated as unavailable
// (NIMBUS-202). Without a known customer id ownership is undecided, so the
// cookie is kept as for any transient fault.
export function activeCartLookup(
  lookup: CartLookup,
  customerId: string | undefined
): CartLookup {
  if (lookup.status !== "found") {
    return lookup
  }
  if (!customerId) {
    return { status: "error" }
  }
  return lookup.cart.customer_id === customerId
    ? lookup
    : { status: "unavailable" }
}
