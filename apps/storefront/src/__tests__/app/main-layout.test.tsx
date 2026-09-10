import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/cart", () => ({
  retrieveCart: jest.fn(() => Promise.resolve(null)),
}))
jest.mock("@/lib/data/customer", () => ({
  retrieveCustomer: jest.fn(() => Promise.resolve(null)),
}))
jest.mock("@/lib/data/fulfillment", () => ({
  listCartFreeShippingPrices: jest.fn(() => Promise.resolve([])),
}))
// The real nav/footer trees pull in `@vercel/analytics` (ESM-only, not
// transformed by Jest) via the cart context — irrelevant to what this test
// covers (the layout's own promo-banner copy), so stub them out.
jest.mock("@/modules/layout/templates/nav", () => ({
  NavigationHeader: () => null,
}))
jest.mock("@/modules/layout/templates/footer", () => () => null)

import PageLayout from "@/app/[countryCode]/(main)/layout"

describe("PageLayout", () => {
  it("renders the extracted promo-banner copy unchanged", async () => {
    const element = await PageLayout({ children: <div>content</div> })
    render(element)

    expect(
      screen.getByText("Build your own B2B store with this starter:")
    ).toBeInTheDocument()
    expect(screen.getByText("Deploy to Medusa Cloud")).toBeInTheDocument()
  })
})
