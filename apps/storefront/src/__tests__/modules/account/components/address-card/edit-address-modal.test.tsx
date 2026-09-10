import { fireEvent, render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"
import type { B2BCustomer } from "@/types/global"

jest.mock("@/lib/data/customer", () => ({
  updateCustomerAddress: jest.fn(),
  deleteCustomerAddress: jest.fn(),
}))

import EditAddress from "@/modules/account/components/address-card/edit-address-modal"

const region = { countries: [] } as unknown as HttpTypes.StoreRegion
const address = {
  id: "addr-1",
  first_name: "Jane",
  last_name: "Doe",
  address_1: "1 Main St",
  postal_code: "10001",
  city: "Metropolis",
  country_code: "us",
} as unknown as HttpTypes.StoreCustomerAddress
const customer = {} as B2BCustomer

describe("EditAddress", () => {
  it("renders the extracted 'Edit'/'Remove' button labels unchanged", () => {
    render(
      <EditAddress region={region} address={address} customer={customer} />
    )

    expect(screen.getByTestId("address-edit-button")).toHaveTextContent("Edit")
    expect(screen.getByTestId("address-delete-button")).toHaveTextContent(
      "Remove"
    )
  })

  it("renders the extracted modal field labels and buttons unchanged", async () => {
    render(
      <EditAddress region={region} address={address} customer={customer} />
    )

    fireEvent.click(screen.getByTestId("address-edit-button"))

    expect(await screen.findByText("Edit address")).toBeInTheDocument()
    expect(screen.getByText("First name")).toBeInTheDocument()
    expect(screen.getByText("Last name")).toBeInTheDocument()
    expect(screen.getByText("Company")).toBeInTheDocument()
    expect(screen.getByText("Postal code")).toBeInTheDocument()
    expect(screen.getByText("Province / State")).toBeInTheDocument()
    expect(screen.getByText("Phone")).toBeInTheDocument()
    expect(screen.getByText("Cancel")).toBeInTheDocument()
    expect(screen.getByText("Save")).toBeInTheDocument()
  })
})
