import { render, screen } from "@testing-library/react"
import { useParams } from "next/navigation"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

jest.mock("@/lib/data/regions", () => ({
  listRegions: jest.fn(async () => [
    {
      id: "reg_1",
      countries: [{ iso_2: "us", display_name: "United States" }],
    },
  ]),
}))

import Footer from "@/modules/layout/templates/footer"

describe("Footer", () => {
  beforeEach(() => {
    ;(useParams as jest.Mock).mockReturnValue({ countryCode: "us" })
  })

  it("TC-3: renders extracted strings unchanged for the en locale", async () => {
    const element = await Footer()
    render(element)

    expect(screen.getByText("NIMBUS NORDIC A/S")).toBeInTheDocument()
    expect(
      screen.getByText(/Nimbus is an international corporate fashion brand/)
    ).toBeInTheDocument()
    expect(
      screen.getByText("Nimbus® | Official B2B Brand Page | EN")
    ).toBeInTheDocument()
  })

  it("TC-3: renders the region switcher", async () => {
    const element = await Footer()
    render(element)

    expect(screen.getByTestId("region-switcher")).toBeInTheDocument()
  })
})
