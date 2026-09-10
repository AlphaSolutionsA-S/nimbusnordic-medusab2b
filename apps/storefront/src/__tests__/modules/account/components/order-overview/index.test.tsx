import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import OrderOverview from "@/modules/account/components/order-overview"

describe("OrderOverview", () => {
  it("renders the extracted empty-state copy unchanged", () => {
    render(<OrderOverview orders={[]} />)

    expect(screen.getByText("Nothing to see here")).toBeInTheDocument()
    expect(
      screen.getByText(
        "You don't have any orders yet, let us change that :)"
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Continue shopping")).toBeInTheDocument()
  })
})
