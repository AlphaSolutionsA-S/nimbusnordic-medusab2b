import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import Help from "@/modules/order/components/help"

describe("Help", () => {
  it("renders all extracted strings unchanged", async () => {
    const element = await Help()
    render(element)

    expect(screen.getByText("Need help?")).toBeInTheDocument()
    expect(screen.getByText("Contact")).toBeInTheDocument()
    expect(screen.getByText("Returns & Exchanges")).toBeInTheDocument()
  })
})
