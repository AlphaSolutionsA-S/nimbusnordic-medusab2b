import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/business-central", () => ({
  listBCReturnReasons: jest.fn(() => Promise.resolve([])),
}))
jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import BcOrderDetailTemplate from "@/modules/account/templates/bc-order-detail-template"

const order = {
  id: "order-1",
  number: "BC-1",
  orderDate: "2026-01-01T00:00:00.000Z",
  currencyCode: "usd",
  customerName: "Jane Doe",
  status: "Open",
  totalAmountExcludingTax: 80,
  totalAmountIncludingTax: 100,
  billToAddress: [],
  shipToAddress: [],
  lines: [
    {
      id: "line-1",
      lineType: "Item",
      itemDisplayName: "Widget",
      quantity: 2,
      unitPrice: 40,
      lineAmount: 80,
    },
  ],
} as any

describe("BcOrderDetailTemplate", () => {
  it("renders the extracted labels and reused bc-order-return copy unchanged", async () => {
    const element = await BcOrderDetailTemplate({ order })
    render(element)

    expect(screen.getByText("Back to BC orders")).toBeInTheDocument()
    expect(screen.getByText("Order #BC-1")).toBeInTheDocument()
    expect(screen.getByText("Bill-to address")).toBeInTheDocument()
    expect(screen.getByText("Ship-to address")).toBeInTheDocument()
    expect(screen.getByText("Customer")).toBeInTheDocument()
    expect(screen.getByText("Total excluding tax", { selector: "dt" })).toBeInTheDocument()
    expect(screen.getByText("Total including tax")).toBeInTheDocument()
    expect(screen.getByText("Items")).toBeInTheDocument()
    expect(screen.getByText("Description")).toBeInTheDocument()
    expect(screen.getByText("Quantity")).toBeInTheDocument()
    expect(screen.getByText("Unit price")).toBeInTheDocument()
    expect(screen.getByText("Amount")).toBeInTheDocument()
    expect(
      screen.getByText("Total excluding tax", { selector: "th" })
    ).toBeInTheDocument()
  })
})
