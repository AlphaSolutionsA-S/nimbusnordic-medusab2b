import { render, screen } from "@testing-library/react"

import AddressSelect from "@/modules/checkout/components/address-select"

describe("AddressSelect", () => {
  it("renders the extracted placeholder unchanged when nothing is selected", () => {
    render(
      <AddressSelect addresses={[]} addressInput={null} onSelect={() => {}} />
    )

    expect(screen.getByText("Choose an address")).toBeInTheDocument()
  })
})
