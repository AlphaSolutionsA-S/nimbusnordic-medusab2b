import { render, screen } from "@testing-library/react"

import BcReturnOverview from "@/modules/account/components/bc-return-overview"

describe("BcReturnOverview", () => {
  it("renders the extracted error-state copy unchanged", async () => {
    const element = await BcReturnOverview({
      result: null,
      error: true,
      currentPage: 1,
      limit: 10,
    })
    render(element)

    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    expect(
      screen.getByText(
        "We were unable to load your returns. Please try again."
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Try again")).toBeInTheDocument()
  })

  it("renders the extracted empty-state copy unchanged", async () => {
    const element = await BcReturnOverview({
      result: { returns: [], count: 0 } as any,
      error: false,
      currentPage: 1,
      limit: 10,
    })
    render(element)

    expect(screen.getByText("No returns found")).toBeInTheDocument()
    expect(
      screen.getByText("You haven't submitted any returns yet.")
    ).toBeInTheDocument()
  })
})
