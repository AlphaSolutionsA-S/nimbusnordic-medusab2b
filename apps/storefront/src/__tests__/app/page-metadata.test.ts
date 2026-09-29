jest.mock("@/lib/data/orders", () => ({
  retrieveOrder: jest.fn(),
  listOrders: jest.fn(async () => []),
}))
jest.mock("@/lib/data/customer", () => ({ retrieveCustomer: jest.fn(async () => null) }))
jest.mock("@/lib/data/cart", () => ({ retrieveCart: jest.fn(async () => null) }))
jest.mock("@/lib/data/regions", () => ({ listRegions: jest.fn(async () => []) }))
jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
  redirect: jest.fn(),
}))
// Page default exports pull in large template trees with untransformed ESM
// dependencies; only generateMetadata is under test (same approach as
// category-page-metadata.test.ts). Stub the templates the imported pages use:
jest.mock("@/modules/order/templates/order-details-template", () => ({ __esModule: true, default: () => null }))
jest.mock("@/modules/order/templates/order-completed-template", () => ({ __esModule: true, default: () => null }))
jest.mock("@/modules/cart/templates", () => ({ __esModule: true, default: () => null }))
jest.mock("@/lib/context/cart-context", () => ({ CartProvider: () => null }))
jest.mock("@/modules/home/components/featured-products", () => ({ __esModule: true, default: () => null }))
jest.mock("@/modules/home/components/hero", () => ({ __esModule: true, default: () => null }))
jest.mock("@/modules/store/templates/paginated-products", () => ({ __esModule: true, default: () => null }))
jest.mock("@/modules/store/components/refinement-list", () => ({ __esModule: true, default: () => null }))
jest.mock("@/modules/checkout/templates/checkout-form", () => ({ __esModule: true, default: () => null }))
jest.mock("@/modules/checkout/templates/checkout-summary", () => ({ __esModule: true, default: () => null }))
jest.mock("@/modules/checkout/components/payment-wrapper", () => ({ __esModule: true, default: () => null }))
jest.mock("@/modules/account/templates/login-template", () => ({ __esModule: true, default: () => null }))
jest.mock("@/modules/account/components/overview", () => ({ __esModule: true, default: () => null }))
jest.mock("@/lib/data/cms", () => ({
  getClaimsPageDocument: jest.fn(async () => null),
  getPayloadLivePreviewURL: jest.fn(() => null),
}))
jest.mock("@/modules/account/components/claims-live-preview", () => ({ ClaimsLivePreview: () => null }))
jest.mock("@/modules/account/components/claims-page-content", () => ({ ClaimsPageContent: () => null }))

import { retrieveOrder } from "@/lib/data/orders"
import { generateMetadata as homeMetadata } from "@/app/[countryCode]/(main)/page"
import { generateMetadata as orderDetailsMetadata } from "@/app/[countryCode]/(main)/account/@dashboard/orders/details/[id]/page"
import { generateMetadata as orderConfirmedMetadata } from "@/app/[countryCode]/(main)/order/confirmed/[id]/page"
import { generateMetadata as accountMetadata } from "@/app/[countryCode]/(main)/account/@dashboard/page"
import { generateMetadata as loginMetadata } from "@/app/[countryCode]/(main)/account/@login/page"
import { generateMetadata as cartMetadata } from "@/app/[countryCode]/(main)/cart/page"
import { generateMetadata as checkoutMetadata } from "@/app/[countryCode]/(checkout)/checkout/page"
import { generateMetadata as storeMetadata } from "@/app/[countryCode]/(main)/store/page"
import { generateMetadata as claimsMetadata } from "@/app/[countryCode]/(main)/account/@dashboard/claims/page"

describe("page generateMetadata", () => {
  it("uses the brand for the home page (TC-2)", async () => {
    const metadata = await homeMetadata()
    expect(metadata.title).toBe("Nimbus Nordic")
    expect(String(metadata.description)).not.toContain("Medusa")
  })

  it("interpolates the order display id (TC-4)", async () => {
    ;(retrieveOrder as jest.Mock).mockResolvedValueOnce({ display_id: 42 })
    expect(
      await orderDetailsMetadata({ params: Promise.resolve({ id: "order_1" }) })
    ).toEqual({ title: "Order #42", description: "View your order." })
  })

  it("still calls notFound for a missing order (TC-5)", async () => {
    ;(retrieveOrder as jest.Mock).mockRejectedValueOnce(new Error("404"))
    await expect(
      orderDetailsMetadata({ params: Promise.resolve({ id: "x" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND")
  })

  it("fixes the order-confirmed typo (TC-6)", async () => {
    expect(await orderConfirmedMetadata()).toEqual({
      title: "Order confirmed",
      description: "Your purchase was successful.",
    })
  })

  it("translates the account page metadata", async () => {
    expect(await accountMetadata()).toEqual({
      title: "Account",
      description: "Overview of your account activity.",
    })
  })

  it("translates the login page metadata", async () => {
    expect(await loginMetadata()).toEqual({
      title: "Log in",
      description: "Log in to your Nimbus Nordic account.",
    })
  })

  it("translates the cart page metadata", async () => {
    expect(await cartMetadata()).toEqual({
      title: "Cart",
      description: "View your cart.",
    })
  })

  it("translates the checkout page title", async () => {
    expect(await checkoutMetadata()).toEqual({ title: "Checkout" })
  })

  it("translates the store page metadata", async () => {
    expect(await storeMetadata()).toEqual({
      title: "Store",
      description: "Explore all of our products.",
    })
  })

  it("translates the claims page metadata", async () => {
    expect(await claimsMetadata()).toEqual({
      title: "Claims",
      description: "Guidance for submitting a claim.",
    })
  })
})
