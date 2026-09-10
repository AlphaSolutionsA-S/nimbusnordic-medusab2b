import { render, screen } from "@testing-library/react"
import { usePathname } from "next/navigation"

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/us/store"),
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import MegaMenu from "@/modules/layout/components/mega-menu/mega-menu"

describe("MegaMenu", () => {
  beforeEach(() => {
    ;(usePathname as jest.Mock).mockReturnValue("/us/store")
  })

  it("TC-1: renders the extracted 'Products' label unchanged", () => {
    render(<MegaMenu categories={[]} />)

    expect(screen.getByText("Products")).toBeInTheDocument()
  })
})
