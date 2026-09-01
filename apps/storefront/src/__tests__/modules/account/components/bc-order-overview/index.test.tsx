import { render, screen } from "@testing-library/react"

import BcOrderOverview from "@/modules/account/components/bc-order-overview"

describe("BcOrderOverview", () => {
  it("renders the extracted error-state copy unchanged", async () => {
    const element = await BcOrderOverview({
      result: null,
      error: true,
      currentPage: 1,
      limit: 10,
    })
    render(element)

    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    expect(
      screen.getByText(
        "We were unable to load your company orders. Please try again."
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Try again")).toBeInTheDocument()
  })

  it("renders the extracted empty-state copy unchanged", async () => {
    const element = await BcOrderOverview({
      result: { orders: [], count: 0 } as any,
      error: false,
      currentPage: 1,
      limit: 10,
    })
    render(element)

    expect(screen.getByText("No company orders found")).toBeInTheDocument()
    expect(
      screen.getByText("Try adjusting your filters to see more results.")
    ).toBeInTheDocument()
  })
})
