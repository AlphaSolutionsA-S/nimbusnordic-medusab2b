import { render, screen } from "@testing-library/react"
import type { B2BCart } from "@/types"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
  usePathname: jest.fn(() => "/us/checkout"),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

jest.mock("@/lib/data/fulfillment", () => ({
  listCartShippingMethods: jest.fn(async () => []),
}))
jest.mock("@/lib/data/payment", () => ({
  listCartPaymentMethods: jest.fn(async () => []),
}))

// Own extraction areas — stubbed here since async Server Components can't be
// rendered directly by RTL when nested.
jest.mock("@/modules/cart/components/approval-status-banner", () => ({
  __esModule: true,
  default: () => <div data-testid="approval-status-banner-stub" />,
}))
jest.mock("@/modules/cart/components/sign-in-prompt", () => ({
  __esModule: true,
  default: () => <div data-testid="sign-in-prompt-stub" />,
}))
jest.mock("@/modules/checkout/components/billing-address", () => ({
  __esModule: true,
  default: () => <div data-testid="billing-address-stub" />,
}))
jest.mock("@/modules/checkout/components/company", () => ({
  __esModule: true,
  default: () => <div data-testid="company-stub" />,
}))
jest.mock("@/modules/checkout/components/contact-details", () => ({
  __esModule: true,
  default: () => <div data-testid="contact-details-stub" />,
}))
jest.mock("@/modules/checkout/components/payment", () => ({
  __esModule: true,
  default: () => <div data-testid="payment-stub" />,
}))
jest.mock("@/modules/checkout/components/shipping", () => ({
  __esModule: true,
  default: () => <div data-testid="shipping-stub" />,
}))
jest.mock("@/modules/checkout/components/shipping-address", () => ({
  __esModule: true,
  default: () => <div data-testid="shipping-address-stub" />,
}))

import CheckoutForm from "@/modules/checkout/templates/checkout-form"

describe("CheckoutForm", () => {
  it("renders the extracted 'Back to shopping cart' label unchanged", async () => {
    const cart = { id: "cart-1" } as unknown as B2BCart

    const element = await CheckoutForm({ cart, customer: null })
    render(element)

    expect(screen.getByText(/Back to shopping cart/)).toBeInTheDocument()
  })
})
