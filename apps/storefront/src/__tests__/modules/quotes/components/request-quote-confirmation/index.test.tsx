import { fireEvent, render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}))

jest.mock("@/lib/data/quotes", () => ({
  createQuote: jest.fn(),
}))

import { RequestQuoteConfirmation } from "@/modules/quotes/components/request-quote-confirmation"

describe("RequestQuoteConfirmation", () => {
  it("renders the extracted dialog strings unchanged", () => {
    render(
      <RequestQuoteConfirmation>
        <button>Open</button>
      </RequestQuoteConfirmation>
    )

    fireEvent.click(screen.getByRole("button", { name: "Open" }))

    expect(screen.getByText("Submit request for quote")).toBeInTheDocument()
    expect(
      screen.getByText(
        "You are about to request a quote for the cart. If you confirm, the cart will be converted to a quote."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Cancel" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Submit" })
    ).toBeInTheDocument()
  })
})
