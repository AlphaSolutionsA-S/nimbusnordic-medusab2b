import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/business-central", () => ({
  retrieveBCOrder: jest.fn(() => Promise.reject(new Error("boom"))),
}))
jest.mock("next/navigation", () => ({
  notFound: jest.fn(),
}))

import BCOrderDetailPage from "@/app/[countryCode]/(main)/account/@dashboard/bcorders/[id]/page"

describe("BCOrderDetailPage", () => {
  it("renders the reused error heading and extracted message unchanged", async () => {
    const element = await BCOrderDetailPage({
      params: Promise.resolve({ id: "order-1" }),
    })
    render(element)

    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    expect(
      screen.getByText(
        "We were unable to load this order. Please try again."
      )
    ).toBeInTheDocument()
  })
})
