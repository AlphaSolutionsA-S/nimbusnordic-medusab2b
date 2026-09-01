import { render, screen } from "@testing-library/react"
import type { B2BCart } from "@/types/global"

jest.mock("@/modules/cart/components/item-full", () => ({
  __esModule: true,
  default: () => <div data-testid="item-full-stub" />,
}))

import ItemsTemplate from "@/modules/cart/templates/items"

describe("ItemsTemplate", () => {
  it("renders the extracted total-items label unchanged", () => {
    const cart = {
      items: [
        { id: "1", quantity: 2 },
        { id: "2", quantity: 3 },
      ],
      item_total: 100,
      currency_code: "usd",
    } as unknown as B2BCart

    render(<ItemsTemplate cart={cart} />)

    expect(screen.getByText("Total: 5 items")).toBeInTheDocument()
  })
})
