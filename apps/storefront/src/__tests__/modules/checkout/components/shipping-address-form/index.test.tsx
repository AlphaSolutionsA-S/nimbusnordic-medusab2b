import { render, screen } from "@testing-library/react"

import ShippingAddressForm from "@/modules/checkout/components/shipping-address-form"

describe("ShippingAddressForm", () => {
  it("TC-1: renders all extracted field labels unchanged", () => {
    render(<ShippingAddressForm customer={null} cart={null} />)

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
    render(<ShippingAddressForm customer={null} cart={null} />)

    expect(
      screen.getByRole("option", { name: "Country" })
    ).toBeInTheDocument()
  })
})
