import { render, screen } from "@testing-library/react"

jest.mock("@/lib/context/cart-context", () => ({
  useCart: jest.fn(() => ({ handleDeleteItem: jest.fn() })),
}))

import DeleteButton from "@/modules/common/components/delete-button"

describe("DeleteButton", () => {
  it("renders the extracted 'Remove' label unchanged", () => {
    render(<DeleteButton id="item-1" />)

    expect(
      screen.getByRole("button", { name: "Remove" })
    ).toBeInTheDocument()
  })
})
