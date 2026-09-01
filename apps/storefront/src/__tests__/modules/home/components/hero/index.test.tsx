import { render, screen } from "@testing-library/react"

import Hero from "@/modules/home/components/hero"

describe("Hero", () => {
  it("renders all extracted strings unchanged", () => {
    render(<Hero />)

    expect(screen.getByAltText("Hero background")).toBeInTheDocument()
    expect(screen.getByText("Be light on your feet")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Portable Bestsellers" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("See our widest selection of electronics")
    ).toBeInTheDocument()
    expect(screen.getByText(/Github Repository/)).toBeInTheDocument()
  })
})
