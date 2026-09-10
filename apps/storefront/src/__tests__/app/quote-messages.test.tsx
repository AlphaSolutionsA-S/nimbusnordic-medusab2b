import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/quotes", () => ({
  createQuoteMessage: jest.fn(),
}))

import QuoteMessages from "@/app/[countryCode]/(main)/account/@dashboard/quotes/components/quote-messages"

const quote = {
  id: "quote-1",
  draft_order: { items: [], currency_code: "usd" },
  messages: [],
} as any

const preview = { items: [] } as any

describe("QuoteMessages", () => {
  it("renders the extracted labels unchanged", () => {
    render(<QuoteMessages quote={quote} preview={preview} />)

    expect(screen.getByText("Messages")).toBeInTheDocument()
    expect(screen.getByText("Pick Quote Item")).toBeInTheDocument()
    expect(
      screen.getByText("Select a quote item to write a message around")
    ).toBeInTheDocument()
    expect(screen.getByText("Send")).toBeInTheDocument()
  })
})
