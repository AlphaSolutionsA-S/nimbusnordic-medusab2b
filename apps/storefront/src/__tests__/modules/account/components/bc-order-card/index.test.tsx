import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import BcOrderCard from "@/modules/account/components/bc-order-card"

const order = {
  id: "order-1",
  number: "BC-1",
  orderDate: "2026-01-01T00:00:00.000Z",
  currencyCode: "usd",
  totalAmountIncludingTax: 100,
  status: "Open",
  invoiceStatus: "open",
} as any

describe("BcOrderCard", () => {
  it("renders the extracted 'Details' link label unchanged", async () => {
    const element = await BcOrderCard({ order })
    render(element)

    expect(screen.getByText("Details")).toBeInTheDocument()
  })

  // TC-1: happy path — the details link routes by order number.
  it("links to the order detail page using the order number, not the internal id", async () => {
    const element = await BcOrderCard({ order })
    render(element)

    const detailsLink = screen.getByTestId("bc-order-details-link")
    expect(detailsLink).toHaveAttribute("href", expect.stringContaining("/account/bcorders/BC-1"))
    expect(detailsLink).not.toHaveAttribute(
      "href",
      expect.stringContaining("/account/bcorders/order-1")
    )
  })

  // TC-2: edge case — an order number containing characters that need URL-encoding still produces a safe link.
  it("URL-encodes an order number that contains characters unsafe for a path segment", async () => {
    const encodedOrder = { ...order, number: "BC/1 2" }
    const element = await BcOrderCard({ order: encodedOrder })
    render(element)

    const detailsLink = screen.getByTestId("bc-order-details-link")
    expect(detailsLink).toHaveAttribute(
      "href",
      expect.stringContaining(encodeURIComponent("BC/1 2"))
    )
  })
})
