import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/quotes", () => ({
  fetchQuotes: jest.fn(() => Promise.resolve({ quotes: [] })),
}))
jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import Quotes from "@/app/[countryCode]/(main)/account/@dashboard/quotes/page"

describe("Quotes page", () => {
  it("renders the extracted heading and empty-state copy unchanged", async () => {
    const element = await Quotes()
    render(element)

    expect(screen.getByText("Quotes")).toBeInTheDocument()
    expect(screen.getByText("Nothing to see here")).toBeInTheDocument()
    expect(
      screen.getByText("You don't have any quotes yet")
    ).toBeInTheDocument()
    expect(screen.getByText("Continue shopping")).toBeInTheDocument()
  })
})
