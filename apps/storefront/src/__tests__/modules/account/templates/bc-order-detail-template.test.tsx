import { render, screen, within } from "@testing-library/react"

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
      shippedQuantity: 0,
      returnableQuantity: 0,
      reservations: [
        {
          id: "res-1",
          quantity: 1,
          reservedFrom: "Stock",
          locationCode: "MAIN",
          freightType: "",
          expectedReceiptDate: null,
          shipmentDate: "2026-10-12",
        },
      ],
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

  it("shows the shipment status and reservations on an order line", async () => {
    const element = await BcOrderDetailTemplate({ order })
    render(element)

    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument()
    expect(
      screen.getByText("Not shipped yet · 1 reserved · 1 awaiting")
    ).toBeInTheDocument()
    expect(
      screen.getByText("1 reserved · From Stock · Location MAIN · Ships 12 Oct 2026")
    ).toBeInTheDocument()
  })

  describe("item line name, description and size", () => {
    const itemLine = {
      lineType: "Item",
      quantity: 1,
      unitPrice: 10,
      lineAmount: 10,
      shippedQuantity: 0,
      returnableQuantity: 0,
      reservations: [],
    }
    const sizedOrder = {
      ...order,
      lines: [
        {
          ...itemLine,
          id: "invoice-line",
          itemDisplayName: "Franklin Unisex - Grey Melange",
          description: "Franklin Unisex - Grey Melange",
          variantCode: "XL",
        },
        {
          ...itemLine,
          id: "open-line",
          itemDisplayName: "Camden Men - Midnight Blue",
          description: "M",
          variantCode: "M",
        },
        {
          ...itemLine,
          id: "plain-line",
          itemDisplayName: "Widget",
          description: "",
        },
        {
          ...itemLine,
          id: "comment-line",
          lineType: "Comment",
          description: "Deliver to the back door",
        },
      ],
    }

    const rowOf = (text: string) => screen.getByText(text).closest("tr") as HTMLElement

    it("shows an invoice line's name once and its size", async () => {
      render(await BcOrderDetailTemplate({ order: sizedOrder }))

      expect(screen.getAllByText("Franklin Unisex - Grey Melange")).toHaveLength(1)
      expect(
        within(rowOf("Franklin Unisex - Grey Melange")).getByText("Size: XL")
      ).toBeInTheDocument()
    })

    it("shows an open line's name and size without repeating the size", async () => {
      render(await BcOrderDetailTemplate({ order: sizedOrder }))

      const row = rowOf("Camden Men - Midnight Blue")
      expect(within(row).getByText("Size: M")).toBeInTheDocument()
      expect(within(row).queryByText("M")).not.toBeInTheDocument()
    })

    it("shows no size label on an item line without a variant code", async () => {
      render(await BcOrderDetailTemplate({ order: sizedOrder }))

      expect(within(rowOf("Widget")).queryByText(/Size/)).not.toBeInTheDocument()
    })

    it("renders a comment line's description across the row as before", async () => {
      render(await BcOrderDetailTemplate({ order: sizedOrder }))

      const cell = screen.getByText("Deliver to the back door")
      expect(cell.tagName).toBe("TD")
      expect(cell).toHaveAttribute("colspan", "5")
    })
  })
})
