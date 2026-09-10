import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import OrderCard from "@/modules/account/components/order-card"

const order = {
  id: "order-1",
  display_id: 1,
  created_at: "2026-01-01T00:00:00.000Z",
  currency_code: "usd",
  total: 100,
  items: [{ id: "item-1", quantity: 2, thumbnail: "/thumb.png", title: "Item" }],
}

describe("OrderCard", () => {
  it("renders the extracted plural item count and 'Details' label unchanged", () => {
    render(<OrderCard order={order as any} />)

    expect(screen.getByText("2 items")).toBeInTheDocument()
    expect(screen.getByText("Details")).toBeInTheDocument()
  })

  it("renders the extracted singular item count unchanged", () => {
    const singleItemOrder = {
      ...order,
      items: [{ id: "item-1", quantity: 1, thumbnail: "/thumb.png", title: "Item" }],
    }

    render(<OrderCard order={singleItemOrder as any} />)

    expect(screen.getByText("1 item")).toBeInTheDocument()
  })
})
