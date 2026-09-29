import { fireEvent, render, screen } from "@testing-library/react"

jest.mock("@/lib/data/business-central", () => ({
  createBCReturn: jest.fn(),
}))

import BcOrderReturn from "@/modules/account/components/bc-order-return"

const order = {
  id: "order-1",
  number: "BC-1",
  currencyCode: "usd",
  billToAddress: [],
  shipToAddress: [],
  lines: [
    {
      id: "line-1",
      sequence: 1,
      lineType: "Item",
      quantity: 2,
      unitPrice: 10,
      itemDisplayName: "Widget",
      shippedQuantity: 2,
      returnableQuantity: 2,
      reservations: [],
    },
    {
      id: "line-2",
      sequence: 2,
      lineType: "Item",
      quantity: 3,
      unitPrice: 10,
      itemDisplayName: "Gadget",
      shippedQuantity: 0,
      returnableQuantity: 0,
      reservations: [],
    },
  ],
} as any

describe("BcOrderReturn", () => {
  it("renders the extracted 'Request a return' trigger unchanged", () => {
    render(
      <BcOrderReturn order={order} reasons={[]}>
        <div>children</div>
      </BcOrderReturn>
    )

    expect(screen.getByText("Request a return")).toBeInTheDocument()
  })

  it("renders the extracted return-form labels unchanged", () => {
    render(
      <BcOrderReturn order={order} reasons={[]}>
        <div>children</div>
      </BcOrderReturn>
    )

    fireEvent.click(screen.getByText("Request a return"))

    expect(screen.getByText("Order number")).toBeInTheDocument()
    expect(screen.getByText("Bill-to address")).toBeInTheDocument()
    expect(screen.getByText("Ship-to address")).toBeInTheDocument()
    expect(screen.getByText("Item")).toBeInTheDocument()
    expect(screen.getByText("Ordered quantity")).toBeInTheDocument()
    expect(screen.getByText("Unit price")).toBeInTheDocument()
    expect(screen.getByText("Return quantity")).toBeInTheDocument()
    expect(screen.getByText("Return reason")).toBeInTheDocument()
    expect(screen.getByText("Cancel")).toBeInTheDocument()
    expect(screen.getByText("Submit return request")).toBeInTheDocument()
  })

  it("disables lines that are not shipped yet and caps the quantity at the returnable amount", () => {
    render(
      <BcOrderReturn order={order} reasons={[]}>
        <div>children</div>
      </BcOrderReturn>
    )

    fireEvent.click(screen.getByText("Request a return"))

    expect(screen.getByText("Status")).toBeInTheDocument()
    expect(screen.getByText("Shipped")).toBeInTheDocument()
    expect(screen.getByText("Not shipped yet")).toBeInTheDocument()

    const [shippedInput, unshippedInput] = screen.getAllByRole("spinbutton")
    expect(shippedInput).toHaveAttribute("max", "2")
    expect(shippedInput).not.toBeDisabled()
    expect(unshippedInput).toBeDisabled()
  })

  it("hides the return trigger when nothing has shipped", () => {
    const unshippedOrder = { ...order, lines: [order.lines[1]] }

    render(
      <BcOrderReturn order={unshippedOrder} reasons={[]}>
        <div>children</div>
      </BcOrderReturn>
    )

    expect(screen.queryByText("Request a return")).not.toBeInTheDocument()
  })
})
