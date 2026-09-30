import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import BcReturnCard from "@/modules/account/components/bc-return-card"

const item = {
  id: "return-1",
  number: "RET-1",
  documentDate: "2026-01-01T00:00:00.000Z",
  status: "Open",
  itemCount: 2,
} as any

describe("BcReturnCard", () => {
  it("renders the extracted 'Details' link label unchanged", async () => {
    const element = await BcReturnCard({ item })
    render(element)

    expect(screen.getByText("Details")).toBeInTheDocument()
  })

  // TC-1: happy path — the details link routes by the return number.
  it("links to the return detail page using the return number, not the internal id", async () => {
    const element = await BcReturnCard({ item })
    render(element)

    const detailsLink = screen.getByTestId("bc-return-details-link")
    expect(detailsLink).toHaveAttribute(
      "href",
      expect.stringContaining("/account/returns/RET-1")
    )
    expect(detailsLink).not.toHaveAttribute(
      "href",
      expect.stringContaining("/account/returns/return-1")
    )
  })

  // TC-2: edge case — a return number containing characters that need URL-encoding still produces a safe link.
  it("URL-encodes a return number that contains characters unsafe for a path segment", async () => {
    const encodedItem = { ...item, number: "RET/1 2" }
    const element = await BcReturnCard({ item: encodedItem })
    render(element)

    const detailsLink = screen.getByTestId("bc-return-details-link")
    expect(detailsLink).toHaveAttribute(
      "href",
      expect.stringContaining(encodeURIComponent("RET/1 2"))
    )
  })

  // TC-3: integration — all required list fields are rendered.
  it("renders return number, status, date and item count", async () => {
    const element = await BcReturnCard({ item })
    render(element)

    expect(screen.getByTestId("bc-return-number")).toHaveTextContent("RET-1")
    expect(screen.getByTestId("bc-return-date")).not.toBeEmptyDOMElement()
    expect(screen.getByTestId("bc-return-status")).toHaveTextContent("Open")
    expect(screen.getByTestId("bc-return-item-count")).toHaveTextContent("Items: 2")
  })

  // TC-4: regression guard — no related-order column (External Document No. is the portal requestId).
  it("does not render a related order number", async () => {
    const element = await BcReturnCard({ item })
    render(element)

    expect(screen.queryByTestId("bc-return-related-order")).toBeNull()
  })

  it("shows a dash when Business Central sends no document date", async () => {
    const element = await BcReturnCard({ item: { ...item, documentDate: "" } })
    render(element)

    expect(screen.getByTestId("bc-return-date")).toHaveTextContent(/^-$/)
  })
})
