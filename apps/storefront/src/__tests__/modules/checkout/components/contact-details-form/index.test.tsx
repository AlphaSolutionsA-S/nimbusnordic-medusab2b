import { render, screen } from "@testing-library/react"

import ContactDetailsForm from "@/modules/checkout/components/contact-details-form"

describe("ContactDetailsForm", () => {
  it("TC-1: renders all extracted field labels and help text unchanged", () => {
    render(<ContactDetailsForm customer={null} cart={null} />)

    expect(screen.getByText("Email")).toBeInTheDocument()
    expect(screen.getByText("Invoice recipient")).toBeInTheDocument()
    expect(screen.getByText("Cost center")).toBeInTheDocument()
    expect(screen.getByText("Requisition number")).toBeInTheDocument()
    expect(screen.getByText("Door code/goods mark")).toBeInTheDocument()
    expect(screen.getByText("Notes")).toBeInTheDocument()
    expect(
      screen.getByText(
        "The note will only appear on the invoice and order confirmation and will not be read by the merchant."
      )
    ).toBeInTheDocument()
  })
})
