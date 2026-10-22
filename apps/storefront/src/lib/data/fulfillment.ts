"use server"

import { sdk } from "@/lib/config"
import { getAuthHeaders } from "@/lib/data/cookies"
import { StoreFreeShippingPrice } from "@/types/shipping-option/http"
import { HttpTypes } from "@medusajs/types"

// Both reads are scoped to a cart the backend checks against the caller, so
// they use no-store: a cached response must never reach another account.
export const listCartShippingMethods = async (cartId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<HttpTypes.StoreShippingOptionListResponse>(
      `/store/shipping-options`,
      {
        method: "GET",
        query: { cart_id: cartId },
        headers,
        cache: "no-store",
      }
    )
    .then(({ shipping_options }) => shipping_options)
    .catch(() => {
      return null
    })
}

export const listCartFreeShippingPrices = async (
  cartId: string
): Promise<StoreFreeShippingPrice[]> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<{
      prices: StoreFreeShippingPrice[]
    }>(`/store/free-shipping/prices`, {
      method: "GET",
      query: { cart_id: cartId },
      headers,
      cache: "no-store",
    })
    .then((data) => data.prices)
}
