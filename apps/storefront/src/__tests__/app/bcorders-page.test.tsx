import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/business-central", () => ({
  listBCOrders: jest.fn(() => Promise.resolve({ orders: [], count: 0 })),
}))
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/account/bcorders"),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))
// bc-order-overview is itself an async Server Component; React's client test
// renderer can't render an unresolved async component as a nested element.
// It has its own dedicated regression test, so stub it here.
jest.mock("@/modules/account/components/bc-order-overview", () => ({
  __esModule: true,
  default: () => null,
}))

import BCOrders from "@/app/[countryCode]/(main)/account/@dashboard/bcorders/page"

describe("BCOrders page", () => {
  it("renders the extracted heading unchanged", async () => {
    const element = await BCOrders({ searchParams: Promise.resolve({}) })
    render(element)

    expect(screen.getByText("BC Orders")).toBeInTheDocument()
  })
})
