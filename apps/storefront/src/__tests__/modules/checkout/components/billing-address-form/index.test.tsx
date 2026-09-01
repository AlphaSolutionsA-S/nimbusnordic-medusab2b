import { render, screen } from "@testing-library/react"

import BillingAddressForm from "@/modules/checkout/components/billing-address-form"

describe("BillingAddressForm", () => {
  it("TC-1: renders all extracted field labels unchanged", () => {
    render(<BillingAddressForm cart={null} />)

    expect(screen.getByText("First name")).toBeInTheDocument()
    expect(screen.getByText("Last name")).toBeInTheDocument()
    expect(screen.getByText("Phone")).toBeInTheDocument()
    expect(screen.getByText("Company name")).toBeInTheDocument()
    expect(screen.getByText("Address")).toBeInTheDocument()
    expect(screen.getByText("Postal code")).toBeInTheDocument()
    expect(screen.getByText("City")).toBeInTheDocument()
    expect(screen.getByText("Province")).toBeInTheDocument()
  })

  it("TC-2: renders the translated country select placeholder", () => {
    render(<BillingAddressForm cart={null} />)

    expect(
      screen.getByRole("option", { name: "Country" })
    ).toBeInTheDocument()
  })
})
