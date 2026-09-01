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
} as any

describe("BcOrderCard", () => {
  it("renders the extracted 'Details' link label unchanged", async () => {
    const element = await BcOrderCard({ order })
    render(element)

    expect(screen.getByText("Details")).toBeInTheDocument()
  })
})
