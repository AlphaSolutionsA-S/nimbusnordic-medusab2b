jest.mock("next-intl/server", () => ({
  ...jest.requireActual("../../../../../../__mocks__/next-intl/server"),
  getLocale: async () => "de",
}))

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "de" })),
}))

import { render, screen } from "@testing-library/react"

import BcOrderCard from "@/modules/account/components/bc-order-card"

const order = {
  id: "order-1",
  number: "BC-1",
  orderDate: "2026-01-15T12:00:00.000Z",
  currencyCode: "usd",
  totalAmountIncludingTax: 100,
  status: "Open",
  invoiceStatus: "open",
} as any

describe("BcOrderCard locale formatting", () => {
  it("formats date and amount with the active locale (TC-8)", async () => {
    render(await BcOrderCard({ order }))
    expect(screen.getByTestId("bc-order-date")).toHaveTextContent("15.1.2026")
    expect(document.body.textContent).toMatch(/100,00\s?\$/)
  })
})
