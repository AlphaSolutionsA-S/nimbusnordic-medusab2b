"use server"

import { sdk } from "@/lib/config"
import { activeCartLookup } from "@/lib/util/active-cart"
import {
  CART_NOT_FOUND_ERROR,
  CART_UNAVAILABLE_ERROR,
  SIGN_IN_REQUIRED_ERROR,
} from "@/lib/util/customer-error"
import medusaError from "@/lib/util/medusa-error"
import { StoreApprovalResponse } from "@/types/approval"
import { B2BCart } from "@/types/global"
import { HttpTypes, StoreCart } from "@medusajs/types"
import { track } from "@vercel/analytics/server"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import {
  getAuthHeaders,
  getCacheTag,
  getCartId,
  removeCartId,
  setCartId,
} from "./cookies"
import { retrieveCustomer } from "./customer"
import { getRegion } from "./regions"

// "unavailable": the backend refused the cart (404, also for a cart another
// account owns); "error": any other failure, so callers never drop a cart
// pointer on a transient fault.
export type CartLookup =
  | { status: "none" }
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "found"; cart: B2BCart }

type AddToCartResult = { error: typeof SIGN_IN_REQUIRED_ERROR } | undefined

function hasToken(headers: object): boolean {
  return "authorization" in headers
}

// The SDK rejects with a FetchError carrying the HTTP `status`.
function responseStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    return typeof error.status === "number" ? error.status : undefined
  }
  return undefined
}

function cartRequestError(error: unknown): never {
  if (responseStatus(error) === 404) {
    throw new Error(CART_UNAVAILABLE_ERROR)
  }
  return medusaError(error)
}

export async function lookupCart(id?: string): Promise<CartLookup> {
  const cartId = id || (await getCartId())
  const headers = await getAuthHeaders()

  // Every store cart route requires a customer token, so a signed-out
  // visitor has no usable cart and the backend is not asked.
  if (!cartId || !hasToken(headers)) {
    return { status: "none" }
  }

  return await sdk.client
    .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${cartId}`, {
      credentials: "include",
      method: "GET",
      query: {
        fields:
          "*items, *region, *items.product, *items.variant, +items.thumbnail, +items.metadata, *promotions, +company.id, +company.name, *company.approval_settings, *customer, *approvals, +completed_at, *approval_status",
      },
      headers,
      // Per-caller response: never reuse it for another account.
      cache: "no-store",
    })
    .then(({ cart }): CartLookup => ({ status: "found", cart: cart as B2BCart }))
    .catch((error): CartLookup => {
      const status = responseStatus(error)
      if (status === 404) {
        return { status: "unavailable" }
      }
      return status === 401 ? { status: "none" } : { status: "error" }
    })
}

export async function retrieveCart(id?: string) {
  const lookup = await lookupCart(id)

  return lookup.status === "found" ? lookup.cart : null
}

export async function getOrSetCart(countryCode: string) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  if (!hasToken(headers)) {
    throw new Error(SIGN_IN_REQUIRED_ERROR)
  }

  const customer = await retrieveCustomer()
  const lookup = activeCartLookup(await lookupCart(), customer?.id)

  if (lookup.status === "error") {
    throw new Error(CART_NOT_FOUND_ERROR)
  }

  let cart = lookup.status === "found" ? lookup.cart : null
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  // A missing, refused or not-owned cookie cart is replaced by a new cart.
  if (!cart) {
    const body = {
      region_id: region.id,
      metadata: {
        company_id: customer?.employee?.company_id,
      },
    }

    const cartResp = await sdk.store.cart.create(body, {}, headers)

    await setCartId(cartResp.cart.id)

    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)

    cart = await retrieveCart(cartResp.cart.id)
  }

  if (cart && cart?.region_id !== region.id) {
    await sdk.store.cart.update(cart.id, { region_id: region.id }, {}, headers)
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  return cart
}

export async function updateCart(data: HttpTypes.StoreUpdateCart) {
  const cartId = await getCartId()

  if (!cartId) {
    throw new Error(CART_NOT_FOUND_ERROR)
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .update(cartId, data, {}, headers)
    .then(async ({ cart }) => {
      const fullfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fullfillmentCacheTag)
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      return cart
    })
    .catch(cartRequestError)
}

// Returns the sign-in code instead of throwing: Next.js hides thrown
// server-action messages from the client in production.
export async function addToCart({
  variantId,
  quantity,
  countryCode,
}: {
  variantId: string
  quantity: number
  countryCode: string
}): Promise<AddToCartResult> {
  if (!variantId) {
    throw new Error("Missing variant ID when adding to cart")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  if (!hasToken(headers)) {
    return { error: SIGN_IN_REQUIRED_ERROR }
  }

  const cart = await getOrSetCart(countryCode)
  if (!cart) {
    throw new Error(CART_NOT_FOUND_ERROR)
  }

  await sdk.store.cart
    .createLineItem(
      cart.id,
      {
        variant_id: variantId,
        quantity,
      },
      {},
      headers
    )
    .then(async () => {
      const fullfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fullfillmentCacheTag)
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
    })
    .catch(cartRequestError)
}

export async function addToCartBulk({
  lineItems,
  countryCode,
}: {
  lineItems: HttpTypes.StoreAddCartLineItem[]
  countryCode: string
}): Promise<AddToCartResult> {
  const authHeaders = await getAuthHeaders()

  if (!hasToken(authHeaders)) {
    return { error: SIGN_IN_REQUIRED_ERROR }
  }

  const cart = await getOrSetCart(countryCode)

  if (!cart) {
    throw new Error(CART_NOT_FOUND_ERROR)
  }

  const headers = {
    "Content-Type": "application/json",
    ...authHeaders,
  } as Record<string, any>

  if (process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY) {
    headers["x-publishable-api-key"] =
      process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
  }

  await fetch(
    `${process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL}/store/carts/${cart.id}/line-items/bulk`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ line_items: lineItems }),
    }
  )
    .then(async () => {
      const fullfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fullfillmentCacheTag)
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
    })
    .catch(medusaError)
}

export async function updateLineItem({
  lineId,
  data,
}: {
  lineId: string
  data: HttpTypes.StoreUpdateCartLineItem
}) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when updating line item")
  }

  const cartId = await getCartId()

  if (!cartId) {
    throw new Error(CART_NOT_FOUND_ERROR)
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart
    .updateLineItem(cartId, lineId, data, {}, headers)
    .then(async () => {
      const fullfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fullfillmentCacheTag)
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
    })
    .catch(cartRequestError)
}

export async function deleteLineItem(lineId: string) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when deleting line item")
  }

  const cartId = await getCartId()
  if (!cartId) {
    throw new Error(CART_NOT_FOUND_ERROR)
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart
    .deleteLineItem(cartId, lineId, {}, headers)
    .then(async () => {
      const fullfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fullfillmentCacheTag)
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
    })
    .catch(cartRequestError)
}

export async function emptyCart() {
  const cart = await retrieveCart()
  if (!cart) {
    throw new Error(CART_NOT_FOUND_ERROR)
  }

  for (const item of cart.items || []) {
    await deleteLineItem(item.id)
  }

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)
}

export async function setShippingMethod({
  cartId,
  shippingMethodId,
}: {
  cartId: string
  shippingMethodId: string
}) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .addShippingMethod(cartId, { option_id: shippingMethodId }, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
    })
    .catch(medusaError)
}

export async function initiatePaymentSession(
  cart: B2BCart,
  data: {
    provider_id: string
    context?: Record<string, unknown>
  }
) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.payment
    .initiatePaymentSession(cart as StoreCart, data, {}, headers)
    .then(async (resp) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      return resp
    })
    .catch(medusaError)
}

export async function applyPromotions(codes: string[]) {
  const cartId = await getCartId()
  if (!cartId) {
    throw new Error(CART_NOT_FOUND_ERROR)
  }

  await updateCart({ promo_codes: codes })
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      const fullfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fullfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function applyGiftCard(code: string) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, { gift_cards: [{ code }] }).then(() => {
  //       revalidateTag(getCacheTag("carts"))
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

export async function removeDiscount(code: string) {
  // const cartId = getCartId()
  // if (!cartId) return "No cartId cookie found"
  // try {
  //   await deleteDiscount(cartId, code)
  //   revalidateTag(getCacheTag("carts"))
  // } catch (error: any) {
  //   throw error
  // }
}

export async function removeGiftCard(
  codeToRemove: string,
  giftCards: any[]
  // giftCards: GiftCard[]
) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, {
  //       gift_cards: [...giftCards]
  //         .filter((gc) => gc.code !== codeToRemove)
  //         .map((gc) => ({ code: gc.code })),
  //     }).then(() => {
  //       revalidateTag(getCacheTag("carts"))
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

export async function submitPromotionForm(
  currentState: unknown,
  formData: FormData
) {
  const code = formData.get("code") as string
  try {
    await applyPromotions([code])
  } catch (e: any) {
    console.error("[customer-error]", {
      context: "cart.submit-promotion",
      message: e.message,
    })
    return e.message
  }
}

// TODO: Pass a POJO instead of a form entity here
export async function setShippingAddress(formData: FormData) {
  try {
    if (!formData) {
      throw new Error("No form data found when setting addresses")
    }

    const cartId = await getCartId()
    const customer = await retrieveCustomer()

    if (!cartId) {
      throw new Error(CART_NOT_FOUND_ERROR)
    }

    const data = {
      shipping_address: {
        first_name: formData.get("shipping_address.first_name"),
        last_name: formData.get("shipping_address.last_name"),
        address_1: formData.get("shipping_address.address_1"),
        address_2: "",
        company: formData.get("shipping_address.company"),
        postal_code: formData.get("shipping_address.postal_code"),
        city: formData.get("shipping_address.city"),
        country_code: formData.get("shipping_address.country_code"),
        province: formData.get("shipping_address.province"),
        phone: formData.get("shipping_address.phone"),
      },
      // customer_id: customer?.id,
      email: customer?.email || formData.get("email"),
    } as any
    await updateCart(data)
  } catch (e: any) {
    throw new Error(e)
  }
}

export async function setBillingAddress(formData: FormData) {
  try {
    const cartId = getCartId()
    if (!cartId) {
      throw new Error(CART_NOT_FOUND_ERROR)
    }

    const data = {
      billing_address: {
        first_name: formData.get("billing_address.first_name"),
        last_name: formData.get("billing_address.last_name"),
        address_1: formData.get("billing_address.address_1"),
        address_2: "",
        company: formData.get("billing_address.company"),
        postal_code: formData.get("billing_address.postal_code"),
        city: formData.get("billing_address.city"),
        country_code: formData.get("billing_address.country_code"),
        province: formData.get("billing_address.province"),
        phone: formData.get("billing_address.phone"),
      },
    } as any

    await updateCart(data)
  } catch (e: any) {
    return e.message
  }
}

export async function setContactDetails(
  currentState: unknown,
  formData: FormData
) {
  try {
    const cartId = getCartId()
    if (!cartId) {
      throw new Error(CART_NOT_FOUND_ERROR)
    }
    const data = {
      email: formData.get("email") as string,
      metadata: {
        invoice_recipient: formData.get("invoice_recipient"),
        cost_center: formData.get("cost_center"),
        requisition_number: formData.get("requisition_number"),
        door_code: formData.get("door_code"),
        notes: formData.get("notes"),
      },
    }
    await updateCart(data)
  } catch (e: any) {
    console.error("[customer-error]", {
      context: "cart.set-contact-details",
      message: e.message,
    })
    return e.message
  }
}

export async function placeOrder(
  cartId?: string
): Promise<HttpTypes.StoreCompleteCartResponse> {
  const id = cartId || (await getCartId())

  if (!id) {
    throw new Error(CART_NOT_FOUND_ERROR)
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const cartsTag = await getCacheTag("carts")
  const ordersTag = await getCacheTag("orders")
  const approvalsTag = await getCacheTag("approvals")

  const response = await sdk.store.cart
    .complete(id, {}, headers)
    .catch(medusaError)

  if (response.type === "cart") {
    return response
  }

  track("order_completed", {
    order_id: response.order.id,
  })

  revalidateTag(cartsTag)
  revalidateTag(ordersTag)
  revalidateTag(approvalsTag)

  await removeCartId()

  redirect(
    `/${response.order.shipping_address?.country_code?.toLowerCase()}/order/confirmed/${
      response.order.id
    }`
  )
}

/**
 * Updates the countrycode param and revalidates the regions cache
 * @param regionId
 * @param countryCode
 */
export async function updateRegion(countryCode: string, currentPath: string) {
  const cartId = await getCartId()
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  if (cartId) {
    await updateCart({ region_id: region.id })
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  const regionCacheTag = await getCacheTag("regions")
  revalidateTag(regionCacheTag)

  const productsCacheTag = await getCacheTag("products")
  revalidateTag(productsCacheTag)

  redirect(`/${countryCode}${currentPath}`)
}

export async function createCartApproval(cartId: string, createdBy: string) {
  const headers = {
    "Content-Type": "application/json",
    ...(await getAuthHeaders()),
  }

  const { approval } = await sdk.client
    .fetch<StoreApprovalResponse>(`/store/carts/${cartId}/approvals`, {
      method: "POST",
      headers,
      credentials: "include",
    })
    .catch((err) => {
      if (err.response?.json) {
        return err.response.json().then((body: any) => {
          throw new Error(body.message || err.message)
        })
      }
      throw err
    })

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)

  const approvalsCacheTag = await getCacheTag("approvals")
  revalidateTag(approvalsCacheTag)

  return approval
}
