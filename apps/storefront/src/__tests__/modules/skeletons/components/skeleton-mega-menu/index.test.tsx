import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "gb" })),
}))

import SkeletonMegaMenu from "@/modules/skeletons/components/skeleton-mega-menu"

describe("SkeletonMegaMenu", () => {
  it("renders the catalog products label (TC-5)", () => {
    render(<SkeletonMegaMenu />)

    expect(screen.getByText("Products")).toBeInTheDocument()
  })
})
