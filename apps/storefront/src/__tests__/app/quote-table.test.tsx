import { render, screen } from "@testing-library/react"

import { QuoteTableItem } from "@/app/[countryCode]/(main)/account/@dashboard/quotes/components/quote-table"

const baseItem = {
  id: "item-1",
  product_title: "Widget",
  quantity: 1,
  unit_price: 10,
  total: 10,
  detail: { fulfilled_quantity: 0 },
  actions: [],
} as any

describe("QuoteTableItem", () => {
  it("renders the extracted 'New' badge unchanged", () => {
    render(
      <QuoteTableItem
        item={{ ...baseItem, actions: [{ action: "ITEM_ADD" }] }}
        currencyCode="usd"
      />
    )

    expect(screen.getByText("New")).toBeInTheDocument()
  })

  it("renders the extracted 'Modified' badge unchanged", () => {
    render(
      <QuoteTableItem
        item={{ ...baseItem, actions: [{ action: "ITEM_UPDATE" }] }}
        currencyCode="usd"
      />
    )

    expect(screen.getByText("Modified")).toBeInTheDocument()
  })

  it("renders the extracted 'Removed' badge unchanged", () => {
    render(
      <QuoteTableItem
        item={{
          ...baseItem,
          quantity: 2,
          detail: { fulfilled_quantity: 2 },
          actions: [{ action: "ITEM_UPDATE" }],
        }}
        currencyCode="usd"
      />
    )

    expect(screen.getByText("Removed")).toBeInTheDocument()
  })
})
