import { render, screen } from "@testing-library/react"

import Thumbnail from "@/modules/products/components/thumbnail"

describe("Thumbnail (products)", () => {
  it("uses the passed alt text (TC-9)", () => {
    render(<Thumbnail thumbnail="/a.png" alt="Polo shirt" />)

    expect(screen.getByAltText("Polo shirt")).toBeInTheDocument()
  })

  it("falls back to the translated alt text (TC-9)", () => {
    render(<Thumbnail thumbnail="/a.png" />)

    expect(screen.getByAltText("Product image")).toBeInTheDocument()
  })
})
