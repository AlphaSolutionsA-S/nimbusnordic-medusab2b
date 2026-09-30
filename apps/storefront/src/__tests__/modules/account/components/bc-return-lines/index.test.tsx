import { render, screen, within } from "@testing-library/react"

import BcReturnLines from "@/modules/account/components/bc-return-lines"
import type { BCReturnDetailLine } from "@/types/bc-order"

const lines: BCReturnDetailLine[] = [
  {
    id: "line-30000",
    sequence: 30000,
    lineType: "Item",
    itemNumber: "FVIE-M-BLACK",
    variantCode: "XL",
    description: "Fjeld Vest",
    unitOfMeasureCode: "PCS",
    quantity: 2,
    quantityReceived: 1,
    returnReasonCode: "NORMAL",
  },
  {
    id: "line-60000",
    sequence: 60000,
    lineType: "Item",
    itemNumber: "F2",
    variantCode: "",
    description: "",
    unitOfMeasureCode: "PCS",
    quantity: 1,
    quantityReceived: 0,
    returnReasonCode: "",
  },
]

describe("BcReturnLines", () => {
  // TC-1: happy path — column headers and per-line values, incl. received quantity.
  it("renders item, unit, requested and received quantities and the reason per line", () => {
    render(<BcReturnLines lines={lines} />)

    expect(screen.getByText("Items")).toBeInTheDocument()
    expect(screen.getByText("Item")).toBeInTheDocument()
    expect(screen.getByText("Unit")).toBeInTheDocument()
    expect(screen.getByText("Requested")).toBeInTheDocument()
    expect(screen.getByText("Received")).toBeInTheDocument()
    expect(screen.getByText("Reason")).toBeInTheDocument()

    const [first, second] = screen.getAllByTestId("bc-return-line")
    expect(within(first).getByText("Fjeld Vest")).toBeInTheDocument()
    expect(within(first).getByTestId("bc-return-line-item-number")).toHaveTextContent(
      "Item no. FVIE-M-BLACK · Variant XL"
    )
    expect(within(first).getByTestId("bc-return-line-quantity")).toHaveTextContent("2")
    expect(within(first).getByTestId("bc-return-line-received")).toHaveTextContent("1")
    expect(within(first).getByTestId("bc-return-line-reason")).toHaveTextContent("NORMAL")

    // Missing description falls back to the item number; no variant suffix; empty reason → "-".
    expect(within(second).getByTestId("bc-return-line-item-number")).toHaveTextContent(
      /^Item no\. F2$/
    )
    expect(within(second).getByTestId("bc-return-line-reason")).toHaveTextContent("-")
  })

  // TC-2: scope decision Q4 — no line prices or amounts are shown.
  it("does not render any price or amount column", () => {
    render(<BcReturnLines lines={lines} />)

    expect(screen.queryByText(/price/i)).toBeNull()
    expect(screen.queryByText(/amount/i)).toBeNull()
  })

  // TC-3: edge case — a return without item lines shows an empty message instead of a table.
  it("renders the empty message when there are no lines", () => {
    render(<BcReturnLines lines={[]} />)

    expect(screen.getByTestId("bc-return-lines-empty")).toHaveTextContent(
      "This return has no item lines."
    )
    expect(screen.queryByRole("table")).toBeNull()
  })
})
