import { fireEvent, render, screen, within } from "@testing-library/react"

jest.mock("@/lib/data/business-central", () => ({
  createBCReturn: jest.fn(),
}))
jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "dk" })),
}))

import { createBCReturn } from "@/lib/data/business-central"
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

  describe("item name, description and size", () => {
    const sizedOrder = {
      ...order,
      lines: [
        {
          ...order.lines[0],
          id: "invoice-line",
          sequence: 10000,
          itemDisplayName: "Franklin Unisex - Grey Melange",
          description: "Franklin Unisex - Grey Melange",
          variantCode: "XL",
        },
        {
          ...order.lines[0],
          id: "open-line",
          sequence: 20000,
          itemDisplayName: "Camden Men - Midnight Blue",
          description: "M",
          variantCode: "M",
        },
        {
          ...order.lines[0],
          id: "extra-line",
          sequence: 30000,
          itemDisplayName: "Widget",
          description: "Embroidered logo",
        },
      ],
    }

    const openReturnForm = () => {
      render(
        <BcOrderReturn order={sizedOrder} reasons={[]}>
          <div>children</div>
        </BcOrderReturn>
      )
      fireEvent.click(screen.getByText("Request a return"))
    }

    const rowOf = (text: string) => screen.getByText(text).closest("tr") as HTMLElement

    it("shows each eligible line's name once, an extra description and the size", () => {
      openReturnForm()

      expect(screen.getAllByText("Franklin Unisex - Grey Melange")).toHaveLength(1)
      expect(
        within(rowOf("Franklin Unisex - Grey Melange")).getByText("Size: XL")
      ).toBeInTheDocument()

      const openRow = rowOf("Camden Men - Midnight Blue")
      expect(within(openRow).getByText("Size: M")).toBeInTheDocument()
      expect(within(openRow).queryByText("M")).not.toBeInTheDocument()

      const extraRow = rowOf("Widget")
      expect(within(extraRow).getByText("Embroidered logo")).toBeInTheDocument()
      expect(within(extraRow).queryByText(/Size/)).not.toBeInTheDocument()
    })

    it("names the product, not the size, in the quantity field's accessible label", () => {
      openReturnForm()

      expect(
        screen.getByRole("spinbutton", {
          name: "Return quantity for Camden Men - Midnight Blue",
        })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole("spinbutton", { name: "Return quantity for M" })
      ).not.toBeInTheDocument()
    })

    it("still submits only line number, quantity and reason", async () => {
      ;(createBCReturn as jest.Mock).mockResolvedValueOnce({
        id: "R-1",
        number: "R-1",
        status: "Open",
        requestId: "RET-3",
        sourceOrderNo: "BC-1",
        lines: [],
      })
      openReturnForm()

      fireEvent.change(
        screen.getByRole("spinbutton", {
          name: "Return quantity for Camden Men - Midnight Blue",
        }),
        { target: { value: "1" } }
      )
      const form = screen.getByText("Submit return request").closest("form") as HTMLFormElement
      fireEvent.submit(form)

      await screen.findByTestId("bc-order-return-view-return-link")
      expect(createBCReturn).toHaveBeenCalledWith("BC-1", {
        lines: [{ source_line_no: 20000, quantity: 1, return_reason_code: "NORMAL" }],
      })
    })
  })

  // TC-5: integration — the return confirmation links to the new return's detail page.
  it("links the return confirmation to the new return's detail page", async () => {
    ;(createBCReturn as jest.Mock).mockResolvedValueOnce({
      id: "31502913",
      number: "31502913",
      status: "Open",
      requestId: "RET-1",
      sourceOrderNo: "BC-1",
      lines: [],
    })

    render(
      <BcOrderReturn order={order} reasons={[]}>
        <div>children</div>
      </BcOrderReturn>
    )

    fireEvent.click(screen.getByText("Request a return"))
    const [shippedInput] = screen.getAllByRole("spinbutton")
    fireEvent.change(shippedInput, { target: { value: "1" } })
    const form = screen.getByText("Submit return request").closest("form") as HTMLFormElement
    fireEvent.submit(form)

    const link = await screen.findByTestId("bc-order-return-view-return-link")
    expect(link).toHaveTextContent("View return")
    expect(link).toHaveAttribute("href", "/dk/account/returns/31502913")
    expect(screen.getByText("Back to order details")).toBeInTheDocument()
  })

  // TC-6: edge case — the return number is URL-encoded in the link.
  it("URL-encodes the return number in the confirmation link", async () => {
    ;(createBCReturn as jest.Mock).mockResolvedValueOnce({
      id: "RO/1",
      number: "RO/1",
      status: "Open",
      requestId: "RET-2",
      sourceOrderNo: "BC-1",
      lines: [],
    })

    render(
      <BcOrderReturn order={order} reasons={[]}>
        <div>children</div>
      </BcOrderReturn>
    )

    fireEvent.click(screen.getByText("Request a return"))
    const [shippedInput] = screen.getAllByRole("spinbutton")
    fireEvent.change(shippedInput, { target: { value: "1" } })
    const form = screen.getByText("Submit return request").closest("form") as HTMLFormElement
    fireEvent.submit(form)

    const link = await screen.findByTestId("bc-order-return-view-return-link")
    expect(link).toHaveAttribute("href", "/dk/account/returns/RO%2F1")
  })
})
