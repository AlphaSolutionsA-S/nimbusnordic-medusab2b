import { render, screen } from "@testing-library/react"

import { ClaimsPageContent } from "@/modules/account/components/claims-page-content"

describe("ClaimsPageContent", () => {
  it("renders the extracted 'Claims' default title when no page is provided", () => {
    render(<ClaimsPageContent page={null} />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Claims" })
    ).toBeInTheDocument()
  })

  it("renders the page's own title when one is provided", () => {
    render(<ClaimsPageContent page={{ title: "Custom title", layout: [] }} />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Custom title" })
    ).toBeInTheDocument()
  })
})
