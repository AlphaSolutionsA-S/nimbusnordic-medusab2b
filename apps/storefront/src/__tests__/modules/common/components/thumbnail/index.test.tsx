import { render, screen } from "@testing-library/react"

import { Thumbnail } from "@/modules/common/components/thumbnail"

// This component is currently unused elsewhere in the app — see the NOTE in
// its source. Kept under regression test since it still ships in the bundle.
describe("Thumbnail (common, unused)", () => {
  it("renders the extracted alt-text fallback unchanged", () => {
    render(<Thumbnail src="/image.png" />)

    expect(screen.getByAltText("test")).toBeInTheDocument()
  })
})
