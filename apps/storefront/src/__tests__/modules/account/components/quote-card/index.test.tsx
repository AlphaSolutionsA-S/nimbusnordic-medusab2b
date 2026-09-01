import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import QuoteCard from "@/modules/account/components/quote-card"

const quote = {
  status: "pending_merchant",
  draft_order: {
    id: "order-1",
    display_id: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    currency_code: "usd",
    total: 100,
    items: [{ id: "item-1", quantity: 2, thumbnail: "/thumb.png", title: "Item" }],
  },
} as any

describe("QuoteCard", () => {
  it("renders the reused plural item count and 'See details' label unchanged", () => {
    render(<QuoteCard quote={quote} />)

    expect(screen.getByText("2 items")).toBeInTheDocument()
    expect(screen.getByText("See details")).toBeInTheDocument()
  })

  it("renders the reused singular item count unchanged", () => {
    const singleItemQuote = {
      ...quote,
      draft_order: {
        ...quote.draft_order,
        items: [{ id: "item-1", quantity: 1, thumbnail: "/thumb.png", title: "Item" }],
      },
    }

    render(<QuoteCard quote={singleItemQuote} />)

    expect(screen.getByText("1 item")).toBeInTheDocument()
  })
})
