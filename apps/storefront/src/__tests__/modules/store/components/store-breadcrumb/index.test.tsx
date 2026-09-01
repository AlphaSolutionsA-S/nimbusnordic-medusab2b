import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import StoreBreadcrumb from "@/modules/store/components/store-breadcrumb"

describe("StoreBreadcrumb", () => {
  it("renders the extracted labels unchanged", async () => {
    const element = await StoreBreadcrumb()
    render(element)

    expect(screen.getByText("Products")).toBeInTheDocument()
    expect(screen.getByText("All products")).toBeInTheDocument()
  })
})
