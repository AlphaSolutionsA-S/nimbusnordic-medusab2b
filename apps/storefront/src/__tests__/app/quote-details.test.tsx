import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/quotes", () => ({
  acceptQuote: jest.fn(),
  rejectQuote: jest.fn(),
  createQuoteMessage: jest.fn(),
}))
jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}))

import QuoteDetails from "@/app/[countryCode]/(main)/account/@dashboard/quotes/components/quote-details"

const quote = {
  id: "quote-1",
  status: "pending_customer",
  draft_order: {
    display_id: 1,
    items: [],
    currency_code: "usd",
    total: 100,
  },
  draft_order_id: "order-1",
  customer: {
    email: "jane@example.com",
    phone: "12345",
    employee: { spending_limit: 0, company: { name: "Acme" } },
  },
  messages: [],
} as any

const preview = { items: [], total: 100 } as any

describe("QuoteDetails", () => {
  it("renders the extracted labels and buttons unchanged", () => {
    render(
      <QuoteDetails quote={quote} preview={preview} countryCode="us" />
    )

    expect(screen.getByText("Back")).toBeInTheDocument()
    expect(screen.getByText("Current Total")).toBeInTheDocument()
    expect(screen.getByText("New Total")).toBeInTheDocument()
    expect(screen.getByText("Reject Quote")).toBeInTheDocument()
    expect(screen.getByText("Accept Quote")).toBeInTheDocument()
    expect(screen.getByText("Quote ID:")).toBeInTheDocument()
    expect(screen.getByText("Customer")).toBeInTheDocument()
    expect(screen.getByText("Email")).toBeInTheDocument()
    expect(screen.getByText("Phone")).toBeInTheDocument()
    expect(screen.getByText("Spend Limit")).toBeInTheDocument()
    expect(screen.getByText("Company")).toBeInTheDocument()
    expect(screen.getByText("Name")).toBeInTheDocument()
  })

  it("renders the extracted accepted-notice copy unchanged", () => {
    render(
      <QuoteDetails
        quote={{ ...quote, status: "accepted" }}
        preview={preview}
        countryCode="us"
      />
    )

    expect(
      screen.getByText(
        "Quote accepted by customer. Order is ready for processing."
      )
    ).toBeInTheDocument()
    expect(screen.getByText("View Order")).toBeInTheDocument()
  })
})
