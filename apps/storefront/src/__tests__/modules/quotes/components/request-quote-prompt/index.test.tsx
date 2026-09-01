import { fireEvent, render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import { RequestQuotePrompt } from "@/modules/quotes/components/request-quote-prompt"

describe("RequestQuotePrompt", () => {
  it("renders the extracted dialog strings unchanged", () => {
    render(
      <RequestQuotePrompt>
        <button>Open</button>
      </RequestQuotePrompt>
    )

    fireEvent.click(screen.getByRole("button", { name: "Open" }))

    expect(screen.getByText("Request a quote")).toBeInTheDocument()
    expect(screen.getByText("Log in")).toBeInTheDocument()
    expect(screen.getByText("create an account")).toBeInTheDocument()
    expect(
      screen.getByText("Add products to your cart")
    ).toBeInTheDocument()
    expect(
      screen.getByText('Open cart & click "Request a quote"')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "We will then get back to you as soon as possible over email"
      )
    ).toBeInTheDocument()
  })
})
