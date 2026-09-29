import { render, screen } from "@testing-library/react"
import React from "react"

import { ClaimsPageContent } from "@/modules/account/components/claims-page-content"
import { mapPayloadClaimsPage } from "@/lib/util/map-claims-page"

describe("mapPayloadClaimsPage", () => {
  it("falls back to the translated default title when the CMS title is missing (TC-8)", () => {
    const page = mapPayloadClaimsPage({ layout: [] })

    expect(page.title).toBeUndefined()

    render(React.createElement(ClaimsPageContent, { page }))
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Claims")
  })
})
