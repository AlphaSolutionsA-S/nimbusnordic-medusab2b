import { render, screen } from "@testing-library/react"

import CountrySelect from "@/modules/checkout/components/country-select"

describe("CountrySelect", () => {
  it("falls back to the hardcoded English placeholder when the caller passes none", () => {
    render(<CountrySelect name="country_code" onChange={() => {}} />)

    expect(
      screen.getByRole("option", { name: "Country" })
    ).toBeInTheDocument()
  })

  it("uses a caller-provided (translated) placeholder when passed", () => {
    render(
      <CountrySelect
        name="country_code"
        onChange={() => {}}
        placeholder="Pays"
      />
    )

    expect(screen.getByRole("option", { name: "Pays" })).toBeInTheDocument()
  })
})
