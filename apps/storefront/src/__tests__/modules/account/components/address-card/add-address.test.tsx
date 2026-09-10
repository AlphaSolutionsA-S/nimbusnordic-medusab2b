import { fireEvent, render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

jest.mock("@/lib/data/customer", () => ({
  addCustomerAddress: jest.fn(),
}))

import AddAddress from "@/modules/account/components/address-card/add-address"

const region = { countries: [] } as unknown as HttpTypes.StoreRegion

describe("AddAddress", () => {
  it("renders the extracted 'New address' trigger unchanged", () => {
    render(<AddAddress region={region} />)

    expect(screen.getByText("New address")).toBeInTheDocument()
  })

  it("renders the extracted modal field labels and buttons unchanged", async () => {
    render(<AddAddress region={region} />)

    fireEvent.click(screen.getByTestId("add-address-button"))

    expect(await screen.findByText("Add address")).toBeInTheDocument()
    expect(screen.getByText("First name")).toBeInTheDocument()
    expect(screen.getByText("Last name")).toBeInTheDocument()
    expect(screen.getByText("Company")).toBeInTheDocument()
    expect(screen.getByText("Address")).toBeInTheDocument()
    expect(screen.getByText("Apartment, suite, etc.")).toBeInTheDocument()
    expect(screen.getByText("Postal code")).toBeInTheDocument()
    expect(screen.getByText("City")).toBeInTheDocument()
    expect(screen.getByText("Province / State")).toBeInTheDocument()
    expect(screen.getByText("Phone")).toBeInTheDocument()
    expect(screen.getByText("Cancel")).toBeInTheDocument()
    expect(screen.getByText("Save")).toBeInTheDocument()
  })
})
