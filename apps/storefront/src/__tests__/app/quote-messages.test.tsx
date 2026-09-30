import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

jest.mock("@/lib/data/quotes", () => ({
  createQuoteMessage: jest.fn(),
}))

import { createQuoteMessage } from "@/lib/data/quotes"
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

  it("shows the translated validation message for an empty message (TC-7)", async () => {
    render(<QuoteMessages quote={quote} preview={preview} />)

    await userEvent.click(screen.getByText("Send"))

    expect(await screen.findByText("Enter a message.")).toBeInTheDocument()
    expect(createQuoteMessage).not.toHaveBeenCalled()
  })
})
