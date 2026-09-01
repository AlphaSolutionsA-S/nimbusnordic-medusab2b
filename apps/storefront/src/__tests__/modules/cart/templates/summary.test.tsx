import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}))

jest.mock("@/lib/context/cart-context", () => ({
  useCart: jest.fn(() => ({
    handleEmptyCart: jest.fn(),
    cart: {
      id: "cart-1",
      currency_code: "usd",
      total: 100,
      item_subtotal: 100,
    },
  })),
}))

jest.mock("@/modules/checkout/components/promotion-code", () => ({
  __esModule: true,
  default: () => <div data-testid="promotion-code-stub" />,
}))

// Own extraction areas — stubbed here to isolate Summary's own strings from
// the quotes module's SDK-backed data fetching.
jest.mock("@/modules/quotes/components/request-quote-confirmation", () => ({
  RequestQuoteConfirmation: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))
jest.mock("@/modules/quotes/components/request-quote-prompt", () => ({
  RequestQuotePrompt: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

import Summary from "@/modules/cart/templates/summary"

describe("Summary", () => {
  it("renders the extracted action labels unchanged for a logged-out customer", () => {
    render(<Summary customer={null} spendLimitExceeded={false} />)

    expect(screen.getByText("Log in to Checkout")).toBeInTheDocument()
    expect(screen.getByText("Request Quote")).toBeInTheDocument()
    expect(screen.getByText("Empty Cart")).toBeInTheDocument()
  })

  it("renders the extracted spending-limit banner message unchanged", () => {
    render(<Summary customer={null} spendLimitExceeded={true} />)

    expect(
      screen.getByText(/This order exceeds your spending limit\./)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Please contact your manager for approval\./)
    ).toBeInTheDocument()
  })
})
